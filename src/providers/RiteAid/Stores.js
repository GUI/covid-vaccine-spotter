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
        const expectedLocation = {
          locationId: parseInt(
            $locationContainer
              .find(".c-location-grid-item-title")
              .text()
              .match(/#(\d+)/)[1],
            10
          ).toString(),
          cityKey: city.cityKey,
          city: _.trim(
            $locationContainer.find(".c-address-city span:first").text()
          ),
          state: city.state,
          postalCode: _.trim(
            $locationContainer.find(".c-address-postal-code").text()
          ),
        };
        Stores.expectedLocations.push(expectedLocation);
        Stores.expectedLocationIds.push(expectedLocation.locationId);
        Stores.expectedPostalCodes.push(expectedLocation.postalCode);
      }
    }

    Stores.expectedPostalCodes = _.uniq(Stores.expectedPostalCodes);

    let { missingPostalCodes } = await Stores.processGrid(
      "state_grid_110km",
      Stores.expectedPostalCodes
    );

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_55km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_22km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_11km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "postal_codes",
        missingPostalCodes
      ));
    }

    await Store.knex().destroy();
  }

  static async refreshStores() {
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

    let { missingPostalCodes } = await Stores.processGrid(
      "state_grid_110km",
      Stores.expectedPostalCodes
    );

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_55km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_22km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "state_grid_11km",
        missingPostalCodes
      ));
    }

    if (missingPostalCodes.length > 0) {
      ({ missingPostalCodes } = await Stores.processGrid(
        "postal_codes",
        missingPostalCodes
      ));
    }

    await Store.knex().destroy();
  }

  static async processGrid(tableName, postalCodes) {
    let gridCells;
    if (tableName === "postal_codes") {
      gridCells = await Store.knex().raw(
        `
        SELECT
          postal_code,
          st_y(location::geometry) AS latitude,
          st_x(location::geometry) AS longitude
        FROM postal_codes
        WHERE postal_code IN (${postalCodes.map(() => "?").join(",")})
        ORDER BY postal_code`,
        postalCodes
      );
    } else {
      gridCells = await Store.knex().raw(
        `
        SELECT DISTINCT ON (g.id)
          g.centroid_postal_code,
          st_y(g.centroid_land_location::geometry) AS latitude,
          st_x(g.centroid_land_location::geometry) AS longitude
        FROM postal_codes AS p
        INNER JOIN ?? AS g ON g.state_code = p.state_code AND st_intersects(p.location, g.geom)
        WHERE p.postal_code IN (${postalCodes.map(() => "?").join(",")})
        ORDER BY g.id`,
        [tableName, ...postalCodes]
      );
    }

    const count = gridCells.rows.length;
    for (const [index, gridCell] of gridCells.rows.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${tableName} ${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
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

    console.info("importedStores: ", Object.keys(Stores.importedStores));
    console.info("Stores.expectedLocationIds: ", Stores.expectedLocationIds);
    console.info("Stores.expectedPostalCodes: ", Stores.expectedPostalCodes);
    console.info("missingLocationIds: ", missingLocationIds);
    console.info("missingPostalCodes: ", missingPostalCodes);

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
        `No results found for ${gridCell.centroid_postal_code}, skipping`
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
