const got = require("got");
const sleep = require("sleep-promise");
const cheerio = require("cheerio");
const _ = require("lodash");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async setup() {
    await ProviderBrand.query()
      .insert({
        provider_id: "rite_aid",
        key: "rite_aid",
        name: "Rite Aid",
        url: "https://www.riteaid.com/pharmacy/covid-qualifier",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query().findOne({
      provider_id: "rite_aid",
      key: "rite_aid",
    });

    Stores.importedStores = {};
  }

  static async findStores() {
    logger.notice("Begin finding all stores...");

    await Stores.setup();

    const stateListResp = await got(
      "https://www.riteaid.com/locations/index.html",
      {
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        retry: 2,
      }
    );
    const $stateList = cheerio.load(stateListResp.body);
    const stateLinks = $stateList("a.c-directory-list-content-item-link");
    const states = [];
    for (const stateLink of stateLinks) {
      states.push(
        stateLink.attribs.href.match(/^([a-z]{2})(\.|\/)/i)[1].toUpperCase()
      );
    }

    const cities = [];
    for (const [index, state] of states.entries()) {
      logger.info(
        `Scanning ${state} for cities (${index + 1} of ${states.length})...`
      );
      await sleep(_.random(25, 75));
      const stateResp = await got(
        `https://www.riteaid.com/locations/${state.toLowerCase()}.html`,
        {
          headers: {
            "User-Agent": "VaccineSpotter.org",
          },
          retry: 2,
        }
      );
      const $state = cheerio.load(stateResp.body);
      const cityLinks = $state("a.c-directory-list-content-item-link");
      for (const cityLink of cityLinks) {
        cities.push({
          state,
          cityKey: cityLink.attribs.href.match(
            /^[a-z]{2}\/([\w-]+)(\.|\/)/i
          )[1],
        });
      }
    }

    Stores.expectedLocations = [];
    Stores.expectedLocationIds = [];
    Stores.expectedPostalCodes = [];
    for (const [index, city] of cities.entries()) {
      logger.info(
        `Scanning ${city.cityKey}, ${city.state} for potential stores (${
          index + 1
        } of ${cities.length})...`
      );
      try {
        await sleep(_.random(25, 75));
        const cityResp = await got(
          `https://www.riteaid.com/locations/${city.state.toLowerCase()}/${
            city.cityKey
          }.html`,
          {
            headers: {
              "User-Agent": "VaccineSpotter.org",
            },
            retry: 2,
          }
        );
        const $city = cheerio.load(cityResp.body);
        const locationContainers = $city(".c-location-grid-item");
        for (const locationContainer of locationContainers) {
          const $locationContainer = $city(locationContainer);
          const locationTitle = $locationContainer
            .find(".c-location-grid-item-title")
            .text();

          if (locationTitle.includes("Closed #")) {
            logger.info(`Skipping closed location ${locationTitle}`);
            continue;
          }

          const hours = $locationContainer.find(".js-location-hours");
          if (hours && hours[1]) {
            const hourDays = JSON.parse($city(hours[1]).attr("data-days"));
            const allPharmacyDaysClosed = hourDays.every(
              (d) => d.intervals.length === 0
            );
            if (allPharmacyDaysClosed) {
              logger.info(`Skipping non-pharmacy location ${locationTitle}`);
              continue;
            }
          }

          const expectedLocation = {
            locationId: parseInt(
              locationTitle.match(/#(\d+)/)[1],
              10
            ).toString(),
            postalCode: _.trim(
              $locationContainer.find(".c-address-postal-code").text()
            ),
          };
          Stores.expectedLocations.push(expectedLocation);
          Stores.expectedLocationIds.push(expectedLocation.locationId);
          Stores.expectedPostalCodes.push(expectedLocation.postalCode);
        }
      } catch (err) {
        // Philedelphia page currently returns an error, so manually deal with
        // those based on our existing data:
        // https://www.riteaid.com/locations/pa/philadelphia.html
        if (city.state === "PA" && city.cityKey === "philadelphia") {
          logger.warn(
            "Error fetching Philadelphia, PA store list, falling back to any existing in database"
          );
          const stores = await Store.query()
            .where("provider_id", "rite_aid")
            .where("state", "PA")
            .where("city", "Philadelphia");
          for (const store of stores) {
            const expectedLocation = {
              locationId: store.provider_location_id,
              postalCode: store.postal_code,
            };
            Stores.expectedLocations.push(expectedLocation);
            Stores.expectedLocationIds.push(expectedLocation.locationId);
            Stores.expectedPostalCodes.push(expectedLocation.postalCode);
          }
        } else {
          throw err;
        }
      }
    }

    Stores.expectedPostalCodes = _.uniq(Stores.expectedPostalCodes);

    let status = await Stores.processGrid(
      "state_grid_110km",
      Stores.expectedPostalCodes
    );

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_55km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_22km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_11km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "postal_codes",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid("custom", [
        // Store #00172, New Castle, DE
        {
          postal_code: "19720",
          latitude: 39.688938793492646,
          longitude: -75.55718926716509,
        },
      ]);
    }

    if (status.missingLocationIds.length > 0) {
      logger.error(
        `Missing locations still remain. Missing locations: ${JSON.stringify(
          status.missingLocationIds
        )}. Missing postal codes: ${JSON.stringify(status.missingPostalCodes)}`
      );
      process.exit(1);
    }

    await Store.knex().destroy();

    logger.notice("Finished finding all stores...");
  }

  static async refreshStores() {
    logger.notice("Begin refreshing all stores...");

    await Stores.setup();

    Stores.expectedLocations = [];
    Stores.expectedLocationIds = [];
    Stores.expectedPostalCodes = [];
    const stores = await Store.query().where("provider_id", "rite_aid");
    for (const store of stores) {
      const expectedLocation = {
        locationId: store.provider_location_id,
        postalCode: store.postal_code,
      };
      Stores.expectedLocations.push(expectedLocation);
      Stores.expectedLocationIds.push(expectedLocation.locationId);
      Stores.expectedPostalCodes.push(expectedLocation.postalCode);
    }

    Stores.expectedPostalCodes = _.uniq(Stores.expectedPostalCodes);

    let status = await Stores.processGrid(
      "state_grid_110km",
      Stores.expectedPostalCodes
    );

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_55km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_22km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "state_grid_11km",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid(
        "postal_codes",
        status.missingPostalCodes
      );
    }

    if (status.missingLocationIds.length > 0) {
      status = await Stores.processGrid("stores", status.missingLocationIds);
    }

    if (status.missingLocationIds.length > 0) {
      logger.error(
        `Missing locations still remain. Missing locations: ${JSON.stringify(
          status.missingLocationIds
        )}. Missing postal codes: ${JSON.stringify(status.missingPostalCodes)}`
      );
      process.exit(1);
    }

    await Store.knex().destroy();

    logger.notice("Finished refreshing all stores...");
  }

  static async processGrid(tableName, lookupValues) {
    let gridCells;
    if (tableName === "postal_codes") {
      gridCells = await Store.knex().raw(
        `
        SELECT
          postal_code,
          st_y(location::geometry) AS latitude,
          st_x(location::geometry) AS longitude
        FROM postal_codes
        WHERE postal_code IN (${lookupValues.map(() => "?").join(",")})
        ORDER BY postal_code`,
        lookupValues
      );
    } else if (tableName === "stores") {
      gridCells = await Store.knex().raw(
        `
        SELECT
          postal_code,
          st_y(location::geometry) AS latitude,
          st_x(location::geometry) AS longitude
        FROM stores
        WHERE provider_id = 'rite_aid'
          AND provider_location_id IN (${lookupValues.map(() => "?").join(",")})
        ORDER BY postal_code`,
        lookupValues
      );
    } else if (tableName === "custom") {
      gridCells = {
        rows: lookupValues,
      };
    } else {
      gridCells = await Store.knex().raw(
        `
        SELECT DISTINCT ON (g.id)
          g.centroid_postal_code,
          st_y(g.centroid_land_location::geometry) AS latitude,
          st_x(g.centroid_land_location::geometry) AS longitude
        FROM postal_codes AS p
        INNER JOIN ?? AS g ON g.state_code = p.state_code AND st_intersects(p.location, g.geom)
        WHERE p.postal_code IN (${lookupValues.map(() => "?").join(",")})
        ORDER BY g.id`,
        [tableName, ...lookupValues]
      );
    }

    const count = gridCells.rows.length;
    logger.notice(`Importing using ${tableName} grid (${count} grid cells)...`);
    for (const [index, gridCell] of gridCells.rows.entries()) {
      logger.info(
        `Importing stores for ${
          gridCell.centroid_postal_code || gridCell.postal_code
        } (${tableName} ${gridCell.latitude},${gridCell.longitude}) (${
          index + 1
        } of ${count})...`
      );

      await Stores.importStoresInGridCell(gridCell, 50);
    }

    const missingLocationIds = _.difference(
      Stores.expectedLocationIds,
      Object.keys(Stores.importedStores)
    );
    const missingPostalCodes = _.uniq(
      missingLocationIds.map(
        (id) =>
          Stores.expectedLocations.find((l) => l.locationId === id).postalCode
      )
    );

    logger.notice(
      `Imported using ${tableName} grid. Total imported: ${
        Object.keys(Stores.importedStores).length
      }. Expected locations: ${
        Stores.expectedLocationIds.length
      }. Expected postal codes: ${
        Stores.expectedPostalCodes.length
      }. Missing locations: ${
        missingLocationIds.length
      }. Missing postal codes: ${missingPostalCodes.length}`
    );

    return {
      missingLocationIds,
      missingPostalCodes,
    };
  }

  static async importStoresInGridCell(gridCell, radius) {
    await sleep(_.random(250, 750));
    const resp = await got(
      "https://www.riteaid.com/services/ext/v2/stores/getStores",
      {
        searchParams: {
          latitude: gridCell.latitude,
          longitude: gridCell.longitude,
          radius,
          pharmacyOnly: "true",
          globalZipCodeRequired: "true",
        },
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    );

    if (!resp.body.Data) {
      logger.info(
        `No results found for ${
          gridCell.centroid_postal_code || gridCell.postal_code
        }, skipping`
      );
      return resp;
    }

    for (const store of resp.body.Data.stores) {
      const storeNumber = store.storeNumber.toString();
      if (Stores.importedStores[storeNumber]) {
        logger.info(`  Skipping already imported store ${storeNumber}`);
      } else {
        logger.info(`  Importing store ${storeNumber}`);
        let timeZone;
        switch (store.timeZone) {
          case "EST":
            timeZone = "America/New_York";
            break;
          case "CST":
            timeZone = "America/Chicago";
            break;
          case "MST":
            timeZone = "America/Denver";
            break;
          case "PST":
            timeZone = "America/Los_Angeles";
            break;
          default:
            throw new Error(`Unknown timezone: ${store.timeZone}`);
        }

        const patch = {
          provider_id: "rite_aid",
          provider_location_id: storeNumber,
          provider_brand_id: Stores.providerBrand.id,
          name: store.name,
          address: store.address,
          city: store.city,
          state: store.state,
          postal_code: store.zipcode,
          location: `point(${store.longitude} ${store.latitude})`,
          location_source: "provider",
          time_zone: timeZone,
          metadata_raw: store,
          carries_vaccine: store.specialServiceKeys.includes("PREF-112"),
        };
        patch.brand = patch.provider_id;
        patch.brand_id = patch.provider_location_id;
        await Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge();

        Stores.importedStores[storeNumber] = true;
      }
    }

    return resp;
  }
}

module.exports = Stores;
