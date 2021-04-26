const _ = require("lodash");
const slug = require("slug");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const sleep = require("sleep-promise");
const cheerio = require("cheerio");
const querystring = require("querystring");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const normalizedAddressKey = require("../../normalizedAddressKey");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const rollbar = require("../../rollbarInit");

class Stores {
  static async findStores() {
    Stores.importedStores = {};

    await Provider.query()
      .insert({
        id: "costco",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "costco",
        key: "costco",
        name: "Costco",
        url: "https://www.costco.com/covid-vaccine.html",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    let status = await Stores.processGrid("country_grid_220km", 100);

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_110km",
        50,
        "country_grid_220km",
        status.reprocessGridIds
      );
    }

    // Manually import "SE San Diego" store. It doesn't report having a
    // pharmacy, but it's in the appointment-plus.com system.
    await Stores.importStoresInGridCell(
      { latitude: 32.712, longitude: -117.114 },
      { hasPharmacy: "false", numOfWarehouses: "1" }
    );

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'costco'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    if (status.reprocessGridIds.length > 0) {
      logger.error(
        `Grids still need reprocessing: ${JSON.stringify(
          status.reprocessGridIds
        )}`
      );
      process.exit(1);
    }

    await Store.knex().destroy();
  }

  static async processGrid(
    tableName,
    gridRadiusMiles,
    joinGridTableName,
    joinGridIds
  ) {
    const knex = Store.knex();
    let grid = knex
      .select(
        knex.raw(
          "grid.id, grid.centroid_postal_code, st_y(grid.centroid_location::geometry) AS latitude, st_x(grid.centroid_location::geometry) AS longitude"
        )
      )
      .from(knex.raw("?? AS grid", [tableName]))
      .orderBy("grid.centroid_postal_code");

    if (joinGridTableName) {
      grid = grid
        .joinRaw("JOIN ?? ON st_intersects(??.geom, grid.geom)", [
          joinGridTableName,
          joinGridTableName,
        ])
        .whereIn(knex.raw("??.id", [joinGridTableName]), joinGridIds);
    }

    grid = await grid;

    const reprocessGridIds = [];
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      const data = await Stores.importStoresInGridCell(gridCell);
      const lastStore = data[data.length - 1];
      if (lastStore.distance < gridRadiusMiles) {
        logger.info(
          `Last store in search radius was less than ${gridRadiusMiles} miles away (${lastStore.distance}), adding grid cell for further reprocessing.`
        );
        reprocessGridIds.push(gridCell.id);
      }
    }

    return {
      reprocessGridIds,
    };
  }

  static async importStoresInGridCell(
    gridCell,
    { hasPharmacy = "true", numOfWarehouses = "50" } = {}
  ) {
    await sleep(1000);

    const lastFetched = DateTime.utc().toISO();
    const resp = throwCurlResponseError(
      await curly.get(
        `https://www.costco.com/AjaxWarehouseBrowseLookupView?${querystring.stringify(
          {
            numOfWarehouses,
            hasPharmacy,
            populateWarehouseDetails: "true",
            latitude: gridCell.latitude,
            longitude: gridCell.longitude,
            countryCode: "US",
          }
        )}`,
        defaultCurlOpts
      )
    );

    const data = JSON.parse(resp.data);
    for (const store of data) {
      if (store === true) {
        continue;
      }

      if (Stores.importedStores[store.identifier]) {
        logger.info(`  Skipping already imported store ${store.identifier}`);
        continue;
      }

      logger.info(`  Importing store ${store.identifier}`);

      const patch = {
        provider_id: "costco",
        provider_location_id: store.identifier,
        provider_brand_id: Stores.providerBrand.id,
        name: store.locationName,
        address: store.address1,
        city: store.city,
        state: store.state,
        postal_code: store.zipCode.substr(0, 5),
        location: `point(${store.longitude} ${store.latitude})`,
        location_source: "provider",
        metadata_raw: { costco: store },
        location_metadata_last_fetched: lastFetched,
      };
      patch.brand = patch.provider_id;
      patch.brand_id = patch.provider_location_id;

      patch.normalized_address_key = normalizedAddressKey({
        address: patch.address,
        city: patch.city,
        state: patch.state,
        postal_code: patch.postal_code,
      });

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge({
          ..._.omit(patch, ["metadata_raw"]),
          metadata_raw: Store.raw(
            "stores.metadata_raw || excluded.metadata_raw"
          ),
        });

      Stores.importedStores[store.identifier] = true;
    }

    return data;
  }

  static async refreshStores() {
    const listingPageResp = await Stores.fetchListingPage();
    const $listingPage = cheerio.load(listingPageResp.data);

    Stores.stateLinks = {};
    Stores.appointmentPlusClientMasterIds = {};

    let stores = await Store.query()
      .select(Store.raw("stores.*"))
      .select(Store.raw("states.name AS state_name"))
      .select(Store.raw("st_y(stores.location::geometry) AS latitude"))
      .select(Store.raw("st_x(stores.location::geometry) AS longitude"))
      .leftJoin("states", "stores.state", "states.code")
      .where("provider_id", "costco")
      .orderBy(["state", "city"]);
    let count = stores.length;
    for (const [index, store] of stores.entries()) {
      logger.info(
        `Initial processing of ${store.state} - ${store.name} (${
          index + 1
        } of ${count})...`
      );

      const bookingLink = Stores.getBookingLink(store, $listingPage);

      if (!bookingLink || !bookingLink.includes("appointment-plus.com")) {
        if (
          bookingLink &&
          ((store.state === "VT" &&
            bookingLink.includes("healthvermont.gov")) ||
            (store.state === "SC" && bookingLink.includes("sc.gov")) ||
            (store.state === "NM" && bookingLink.includes("nmhealth.org")))
        ) {
          logger.info(`Skipping state-run website ${store.state}`);
        } else {
          logger.warn(
            `Skipping unknown store website ${store.state} ${store.name} - ${bookingLink}`
          );
        }

        continue;
      }

      const patch = {
        metadata_raw: store.metadata_raw || {},
      };

      if (!patch.metadata_raw.appointment_plus) {
        patch.metadata_raw.appointment_plus = {};
      }

      patch.metadata_raw.appointment_plus.booking_link = bookingLink;
      // eslint-disable-next-line prefer-destructuring
      patch.metadata_raw.appointment_plus.booking_id = bookingLink.match(
        /appointment-plus.com\/(\w+)/
      )[1];

      const clientMasterId = await Stores.getAppointmentPlusClientMasterId(
        patch.metadata_raw
      );
      if (clientMasterId) {
        patch.metadata_raw.appointment_plus.client_master_id = clientMasterId;
      }

      await Store.query().findById(store.id).patch(patch);
    }

    const matchedClientStoreIds = {};
    stores = await Store.query()
      .select(Store.raw("*"))
      .select(Store.raw("st_y(location::geometry) AS latitude"))
      .select(Store.raw("st_x(location::geometry) AS longitude"))
      .where("provider_id", "costco")
      .orderBy(["state", "city"]);
    count = stores.length;
    for (const [index, store] of stores.entries()) {
      try {
        if (matchedClientStoreIds[store.id]) {
          logger.info(
            `Already updated store with client from another request: ${store.state} - ${store.name}`
          );
          continue;
        }

        if (!store.metadata_raw?.appointment_plus?.client_master_id) {
          logger.warn(
            `Skipping over store without client master ID: ${store.state} - ${store.name}`
          );
          continue;
        }

        logger.info(
          `Final processing of ${store.state} - ${store.name} (${
            index + 1
          } of ${count})...`
        );

        const resp = await Stores.fetchAppointmentPlusClientsResp(store);
        for (const client of resp.data.clientObjects) {
          let clientAddressKey = normalizedAddressKey({
            address: client.address1,
            city: client.city,
            state: client.state,
            postal_code: client.postalCode,
          });
          if (
            clientAddressKey === "1600-el-camino-real-san-francisco-ca-94080"
          ) {
            clientAddressKey =
              "1600-el-camino-real-south-san-francisco-ca-94080";
          } else if (
            clientAddressKey === "999-elmhurst-rd-mt-prospect-il-60056"
          ) {
            clientAddressKey = "999-n-elmhurst-rd-mount-prospect-il-60056";
          } else if (
            clientAddressKey === "1324-s-route-59-naperville-il-60564"
          ) {
            clientAddressKey = "1320-s-route-59-naperville-il-60564";
          } else if (
            clientAddressKey === "3220-northern-pacific-ave-missoula-mt-59802"
          ) {
            clientAddressKey = "3220-n-reserve-st-missoula-mt-59808";
          } else if (
            clientAddressKey === "392-talbert-rd-moorseville-tn-28117"
          ) {
            clientAddressKey = "392-talbert-rd-mooresville-nc-28117";
          } else if (
            clientAddressKey === "851-s-state-highway-121-lewisville-tx-75067"
          ) {
            clientAddressKey = "851-state-highway-121-byp-lewisville-tx-75067";
          } else if (
            clientAddressKey === "1201-n-fm-1604-e-san-antonio-tx-78232"
          ) {
            clientAddressKey = "1201-n-loop-1604-e-san-antonio-tx-78232";
          }

          let clientStore = await Store.query().findOne({
            provider_id: "costco",
            normalized_address_key: clientAddressKey,
          });

          if (!clientStore) {
            clientStore = await Store.query()
              .where("provider_id", "costco")
              .whereRaw(
                "metadata_raw->'appointment_plus'->'client'->'id' = ?",
                client.id
              )
              .first();
          }

          if (!clientStore) {
            const clientStores = await Store.query()
              .from(
                Store.raw(
                  "stores, CAST(ST_SetSRID(ST_MakePoint(?, ?), 4326) AS geography) AS input_point",
                  [client.longitude, client.latitude]
                )
              )
              .select(Store.raw("*"))
              .select(Store.raw("location <-> input_point AS distance"))
              .where("provider_id", "costco")
              .where("state", client.state)
              .whereRaw("st_dwithin(location, input_point, 2000)")
              .orderBy("distance");
            if (clientStores.length > 1) {
              logger.error(
                `Client matched to more than 1 store in database: ${JSON.stringify(
                  client
                )} ${JSON.stringify(
                  clientStores.map((s) =>
                    _.pick(
                      s,
                      "id",
                      "name",
                      "city",
                      "state",
                      "address",
                      "postal_code",
                      "normalized_address_key",
                      "distance"
                    )
                  )
                )}`
              );
              continue;
            }

            // eslint-disable-next-line prefer-destructuring
            clientStore = clientStores[0];
          }

          if (!clientStore) {
            logger.error(
              `Could not match client to store in database: ${JSON.stringify(
                client
              )}`
            );
            continue;
          }

          if (matchedClientStoreIds[clientStore.id]) {
            logger.info(
              `Already updated store with client from another request: ${store.state} - ${store.name}`
            );
            continue;
          }

          const lastFetched = DateTime.utc().toISO();
          const patch = {
            metadata_raw: clientStore.metadata_raw || {},
            location_metadata_last_fetched: lastFetched,
          };

          if (!patch.metadata_raw.appointment_plus) {
            patch.metadata_raw.appointment_plus = {};
          }

          patch.metadata_raw.appointment_plus.client = client;

          const employeesResp = await Stores.fetchAppointmentPlusEmployeesResp(
            patch.metadata_raw
          );
          if (employeesResp?.data) {
            patch.metadata_raw.appointment_plus.employees = employeesResp.data;

            const employeeServices = {};
            for (const employee of employeesResp.data.employeeObjects) {
              const servicesResp = await Stores.fetchAppointmentPlusServicesResp(
                patch.metadata_raw,
                employee
              );
              if (servicesResp?.data) {
                employeeServices[employee.id] = servicesResp.data;
              }
            }

            delete patch.metadata_raw.appointment_plus.services;
            if (
              !patch.metadata_raw.appointment_plus.employee_services ||
              Object.keys(employeeServices).length > 0
            ) {
              patch.metadata_raw.appointment_plus.employee_services = employeeServices;
            }
          }

          await Store.query().findById(clientStore.id).patch(patch);

          matchedClientStoreIds[clientStore.id] = true;
        }
      } catch (err) {
        logger.error(err);
        rollbar.error(err);
      }
    }
  }

  static async fetchListingPage() {
    return throwCurlResponseError(
      await curly.get(
        "https://www.costco.com/covid-vaccine.html",
        defaultCurlOpts
      )
    );
  }

  static getBookingLink(store, $listingPage) {
    let stateName = store.state_name;
    if (store.state === "DC") {
      stateName = "D.C.";
    }

    if (!Stores.stateLinks[store.state]) {
      let links = $listingPage(
        `#search-results p > a:contains('${stateName}')`
      );

      if (links.length === 0) {
        links = $listingPage(
          "#search-results p:contains('All US Locations') a[href*='appointment-plus.com']"
        );
      }

      if (links.length === 0) {
        logger.warn(
          `Could not find link for state ${stateName}, falling back to default link`
        );
        Stores.stateLinks[store.state] =
          "https://book-costcopharmacy.appointment-plus.com/d133yng2/";
      } else if (links.length > 1) {
        logger.error(`Found too many links for state ${stateName}`);
      } else {
        Stores.stateLinks[store.state] = $listingPage(links[0]).attr("href");
      }
    }

    const stateLink = Stores.stateLinks[store.state];
    let bookingLink = stateLink;

    if (stateLink?.startsWith("#")) {
      const statePanel = $listingPage(
        `#search-results .panel:contains('${stateName}')`
      );

      let storeNames = [store.name];
      storeNames.push(store.name.replace(` ${store.state}`, ""));
      if (store.state === "AZ" && store.name === "N Phoenix") {
        storeNames.push("North Phoenix");
      } else if (store.state === "CA" && store.name === "Rancho Del Rey") {
        storeNames.push("Rancho Del Ray");
      } else if (store.state === "CA" && store.name === "N Fresno") {
        storeNames.push("North Fresno");
      } else if (store.state === "CA" && store.name === "Mountain View") {
        storeNames.push("Mt.View");
      } else if (
        store.state === "CA" &&
        store.name === "Cal Expo (Sacramento)"
      ) {
        storeNames.push("Cal Expo");
      } else if (store.state === "CA" && store.name === "Sacramento") {
        storeNames.push("S. Sacramento");
      } else if (store.state === "CA" && store.name === "Carmel Mountain") {
        storeNames.push("San Diego Carmel Mountain");
      } else if (store.state === "GA" && store.name === "Mall Of Georgia") {
        storeNames.push("Mall of GA");
      } else if (store.state === "GA" && store.name === "Fort Oglethorpe") {
        storeNames.push("Ft Oglethorpe");
      } else if (store.state === "HI" && store.name !== "Maui") {
        storeNames.push("Hawaii");
      } else if (store.state === "MN" && store.name === "St Cloud") {
        storeNames.push("St. Cloud");
      } else if (
        store.state === "MN" &&
        store.name !== "Baxter" &&
        store.name !== "Rochester" &&
        store.name !== "St Cloud"
      ) {
        storeNames.push("Minnesota");
      } else if (store.state === "NM") {
        storeNames.push("site");
      } else if (
        store.state === "NY" &&
        store.name !== "Brooklyn" &&
        store.name !== "Manhattan" &&
        store.name !== "Staten Island" &&
        store.name !== "Rego Park" &&
        store.name !== "Queens"
      ) {
        storeNames.push("New York");
      } else if (store.state === "PA" && store.name === "Homestead") {
        storeNames.push("West Homestead");
      } else if (store.state === "PA" && store.name === "Montgomeryville") {
        storeNames.push("Montgomery Township");
      } else if (store.state === "PA" && store.name === "Sanatoga") {
        storeNames.push("Pottstown");
      } else if (store.state === "WA" && store.name === "Aurora Village") {
        storeNames.push("Aurora");
      }
      storeNames = _.uniq(storeNames);

      let links;
      for (const storeName of storeNames) {
        const storeNameSlug = slug(storeName, { remove: /\s+/g });
        links = statePanel.find(`.panel-body a`).filter(function nameMatch() {
          return (
            slug($listingPage(this).text(), { remove: /\s+/g }) ===
            storeNameSlug
          );
        });
        if (links.length === 1) {
          break;
        }
      }

      if (links.length === 0) {
        logger.error(
          `Could not find link for store ${store.state} - ${
            store.name
          } (${JSON.stringify(storeNames)})`
        );
      } else if (links.length > 1) {
        logger.error(
          `Found too many links for store ${store.state} - ${
            store.name
          } (${JSON.stringify(storeNames)})`
        );
      } else {
        bookingLink = $listingPage(links[0]).attr("href");
      }
    }

    return bookingLink;
  }

  static async getAppointmentPlusClientMasterId(metadataRaw) {
    const bookingId = metadataRaw.appointment_plus.booking_id;
    if (Stores.appointmentPlusClientMasterIds[bookingId] !== undefined) {
      return Stores.appointmentPlusClientMasterIds[bookingId];
    }

    logger.info(`Finding client_master_id for ${bookingId}`);

    await sleep(1000);
    const bookingLink = metadataRaw.appointment_plus.booking_link;
    const resp = throwCurlResponseError(
      await curly.get(bookingLink, {
        ...defaultCurlOpts,
        followLocation: true,
      })
    );

    const $page = cheerio.load(resp.data);
    let clientMasterId = $page("input[id=ReactClientMasterId]").val();

    if (!clientMasterId && !metadataRaw.appointment_plus.client_master_id) {
      logger.info(
        "client_master_id not found on booking link, and not present yet, trying preferences request"
      );

      const prefResp = throwCurlResponseError(
        await curly.get(
          `https://book-costcopharmacy.appointment-plus.com/get-preferences?${querystring.stringify(
            {
              clientMasterId: "",
              clientId: "",
              bookingId,
              _: _.random(0, 999999999999),
            }
          )}`,
          defaultCurlOpts
        )
      );

      clientMasterId = prefResp.data?.data?.clientmasterId;
    }

    if (!clientMasterId) {
      clientMasterId = false;
    }

    Stores.appointmentPlusClientMasterIds[bookingId] = clientMasterId;
    return Stores.appointmentPlusClientMasterIds[bookingId];
  }

  static async fetchAppointmentPlusClientsResp(store) {
    logger.info(
      `Fetching appointments-plus clients near ${store.state} - ${store.name}`
    );

    await sleep(1000);
    return throwCurlResponseError(
      await curly.get(
        `https://book.appointment-plus.com/book-appointment/get-clients?${querystring.stringify(
          {
            clientMasterId:
              store.metadata_raw.appointment_plus.client_master_id,
            pageNumber: "1",
            itemsPerPage: "20",
            keyword: "",
            clientId: "",
            employeeId: "",
            "centerCoordinates[id]": "",
            "centerCoordinates[latitude]": store.latitude,
            "centerCoordinates[longitude]": store.longitude,
            "centerCoordinates[accuracy]": "84541",
            "centerCoordinates[whenAdded]": "",
            "centerCoordinates[searchQuery]": "",
            radiusInKilometers: "100",
            _: _.random(0, 999999999999),
          }
        )}`,
        defaultCurlOpts
      )
    );
  }

  static async fetchAppointmentPlusEmployeesResp(metadataRaw) {
    logger.info(
      `Fetching appointments-plus employees for client ${metadataRaw.appointment_plus.client.id}`
    );

    await sleep(1000);
    return throwCurlResponseError(
      await curly.get(
        `https://book.appointment-plus.com/book-appointment/get-employees?${querystring.stringify(
          {
            clientMasterId: metadataRaw.appointment_plus.client_master_id,
            clientId: metadataRaw.appointment_plus.client.id,
            pageNumber: "1",
            itemsPerPage: "10",
            keyword: "",
            employeeId: "",
            _: _.random(0, 999999999999),
          }
        )}`,
        defaultCurlOpts
      )
    );
  }

  static async fetchAppointmentPlusServicesResp(metadataRaw, employee) {
    logger.info(
      `Fetching appointments-plus services for client ${metadataRaw.appointment_plus.client.id}, employee ${employee.id}`
    );

    return throwCurlResponseError(
      await curly.get(
        `https://book.appointment-plus.com/book-appointment/get-services/${
          employee.id
        }?${querystring.stringify({
          clientMasterId: metadataRaw.appointment_plus.client_master_id,
          clientId: metadataRaw.appointment_plus.client.id,
          pageNumber: "1",
          itemsPerPage: "10",
          keyword: "",
          serviceId: "",
          _: _.random(0, 999999999999),
        })}`,
        defaultCurlOpts
      )
    );
  }
}

module.exports = Stores;
