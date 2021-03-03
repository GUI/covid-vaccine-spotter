const got = require("got");
const sleep = require("sleep-promise");
const cheerio = require("cheerio");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

const RiteAidStores = {
  findStores: async () => {
    const importedStores = {};

    const stateListResp = await got(
      "https://www.riteaid.com/locations/index.html"
    );
    const $stateList = cheerio.load(stateListResp.body);
    const stateLinks = $stateList("a.c-directory-list-content-item-link");
    const states = [];
    for (const stateLink of stateLinks) {
      states.push(
        stateLink.attribs.href.match(/^([a-z]{2})(\.|\/)/i)[1].toUpperCase()
      );
    }

    const reprocess110kmGridIds = [];
    const reprocess22kmGridIds = [];

    const manualGrids = [
      { latitude: 34.1044246, longitude: -118.3097044 },
      { latitude: 39.5647898, longitude: -76.9785755 },
      { latitude: 39.9212072, longitude: -75.1464228 },
      { latitude: 39.930283, longitude: -75.155923 },
      { latitude: 39.939368, longitude: -75.1572549 },
      { latitude: 39.9401424, longitude: -75.1514677 },
      { latitude: 39.9473147, longitude: -75.2288691 },
      { latitude: 39.9486954, longitude: -75.1641281 },
      { latitude: 39.9507558, longitude: -75.1533462 },
      { latitude: 39.9513427, longitude: -75.1569356 },
      { latitude: 39.9543267, longitude: -75.2741241 },
      { latitude: 39.9580778, longitude: -75.2575095 },
      { latitude: 39.9614548, longitude: -75.1447182 },
      { latitude: 39.9657089, longitude: -75.2466544 },
      { latitude: 39.9974096, longitude: -75.0740282 },
      { latitude: 40.0128313, longitude: -75.1929419 },
      { latitude: 40.030833, longitude: -75.211315 },
      { latitude: 40.0368276, longitude: -75.1305909 },
      { latitude: 40.03998987581323, longitude: -75.10969787836075 },
      { latitude: 40.064451, longitude: -75.084091 },
      { latitude: 40.2363651, longitude: -83.3559908 },
      { latitude: 40.4287549, longitude: -79.9783822 },
      { latitude: 40.4307609, longitude: -80.0100129 },
      { latitude: 40.440966287393145, longitude: -80.00384823249078 },
      { latitude: 40.4410665, longitude: -79.9572957 },
      { latitude: 40.4417255, longitude: -79.9978963 },
      { latitude: 40.496287319053856, longitude: -80.24657177638244 },
      { latitude: 40.649809, longitude: -73.9587198 },
      { latitude: 40.6508742, longitude: -73.9506628 },
      { latitude: 40.6607346, longitude: -73.920321 },
      { latitude: 40.6690653, longitude: -73.9793207 },
      { latitude: 40.669621, longitude: -73.9128528 },
      { latitude: 40.681282, longitude: -73.994556 },
      { latitude: 40.72577194797657, longitude: -73.98705326401341 },
      { latitude: 40.7421044, longitude: -73.9184914 },
      { latitude: 40.7440568, longitude: -73.914465 },
      { latitude: 40.74468232912069, longitude: -73.90370696783066 },
      { latitude: 40.7499286, longitude: -73.8842128 },
      { latitude: 40.7557657, longitude: -73.8821267 },
      { latitude: 40.758858, longitude: -82.5523402 },
      { latitude: 40.8219551, longitude: -73.8915036 },
      { latitude: 40.8284054, longitude: -73.8794421 },
      { latitude: 40.8356081, longitude: -73.9281081 },
      { latitude: 40.841898, longitude: -73.911928 },
      { latitude: 42.921949, longitude: -78.7836759 },
    ];
    const manualCount = manualGrids.length;
    for (const [index, gridCell] of manualGrids.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${manualCount})...`
      );

      await RiteAidStores.importStoresInGridCell(gridCell, 50, importedStores);
    }

    const knex = Store.knex();
    const grid = await knex
      .select(
        knex.raw(
          "id, centroid_postal_code, st_y(centroid_location::geometry) AS latitude, st_x(centroid_location::geometry) AS longitude"
        )
      )
      .from("state_grid_110km")
      .whereIn("state_code", states)
      .orderBy("centroid_postal_code");
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      const resp = await RiteAidStores.importStoresInGridCell(
        gridCell,
        50,
        importedStores
      );

      if (resp.body.Data.stores.length >= 10) {
        logger.warn(
          `There may be more stores within the 50 mile radius than returned, since the maximum of 10 stores was returned: ${gridCell.centroid_postal_code}. Adding zip code for further 10 mile reprocessing.`
        );
        reprocess110kmGridIds.push(gridCell.id);
      }
    }

    if (reprocess110kmGridIds.length > 0) {
      const smallGrid = await knex
        .select(
          knex.raw(
            "country_grid_22km.id, country_grid_22km.centroid_postal_code, st_y(country_grid_22km.centroid_location::geometry) AS latitude, st_x(country_grid_22km.centroid_location::geometry) AS longitude"
          )
        )
        .from("state_grid_110km")
        .joinRaw(
          "JOIN country_grid_22km ON st_intersects(state_grid_110km.geom, country_grid_22km.geom)"
        )
        .whereIn("state_grid_110km.id", reprocess110kmGridIds)
        .orderBy("centroid_postal_code");
      const smallGridCount = smallGrid.length;
      for (const [index, gridCell] of smallGrid.entries()) {
        logger.info(
          `Re-importing stores for ${gridCell.centroid_postal_code} (${
            gridCell.latitude
          },${gridCell.longitude}) with smaller 10 mile radius grid (${
            index + 1
          } of ${smallGridCount})...`
        );

        const resp = await RiteAidStores.importStoresInGridCell(
          gridCell,
          10,
          importedStores
        );

        if (resp.body.Data.stores.length >= 10) {
          logger.warn(
            `There may be more stores within the 10 mile radius than returned, since the maximum of 10 stores was returned: ${gridCell.centroid_postal_code}. Adding zip code for further 5 mile reprocessing.`
          );
          reprocess22kmGridIds.push(gridCell.id);
        }
      }
    }

    if (reprocess22kmGridIds.length > 0) {
      const smallGrid = await knex
        .select(
          knex.raw(
            "country_grid_11km.id, country_grid_11km.centroid_postal_code, st_y(country_grid_11km.centroid_location::geometry) AS latitude, st_x(country_grid_11km.centroid_location::geometry) AS longitude"
          )
        )
        .from("country_grid_22km")
        .joinRaw(
          "JOIN country_grid_11km ON st_intersects(country_grid_22km.geom, country_grid_11km.geom)"
        )
        .whereIn("country_grid_22km.id", reprocess22kmGridIds)
        .orderBy("centroid_postal_code");
      const smallGridCount = smallGrid.length;
      for (const [index, gridCell] of smallGrid.entries()) {
        logger.info(
          `Re-importing stores for ${gridCell.centroid_postal_code} (${
            gridCell.latitude
          },${gridCell.longitude}) with smaller 5 mile radius grid (${
            index + 1
          } of ${smallGridCount})...`
        );

        const resp = await RiteAidStores.importStoresInGridCell(
          gridCell,
          5,
          importedStores
        );

        if (
          resp.body.Data.stores.length >= 10 &&
          resp.body.Data.stores[9].milesFromCenter <= 5
        ) {
          logger.error(
            `There may be more stores within the 5 mile radius than returned, since the maximum of 10 stores was returned: ${gridCell.centroid_postal_code}. No smaller grid available, check manually.`
          );
        }
      }
    }

    await Store.knex().destroy();
  },

  importStoresInGridCell: async (gridCell, radius, importedStores) => {
    await sleep(1000);
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
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
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
      if (importedStores[store.storeNumber]) {
        logger.info(`  Skipping already imported store ${store.storeNumber}`);
      } else {
        logger.info(`  Importing store ${store.storeNumber}`);
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

        await Store.query()
          .insert({
            brand: "rite_aid",
            brand_id: store.storeNumber,
            name: store.name,
            address: store.address,
            city: store.city,
            state: store.state,
            postal_code: store.zipcode,
            location: `point(${store.longitude} ${store.latitude})`,
            time_zone: timeZone,
            metadata_raw: store,
          })
          .onConflict(["brand", "brand_id"])
          .merge();

        importedStores[store.storeNumber] = true;
      }
    }

    return resp;
  },

  refreshStores: async () => {
    await Store.query()
      .where("brand", "rite_aid")
      .update({
        carries_vaccine: Store.raw(
          "metadata_raw->'specialServiceKeys' \\? 'PREF-112'"
        ),
      });

    await Store.knex().destroy();
  },
};

module.exports = RiteAidStores;
