const _ = require("lodash");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const sleep = require("sleep-promise");
const querystring = require("querystring");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");

class Stores {
  static async findStores() {
    Stores.processedPostalCodes = {};
    Stores.importedStores = {};

    await Provider.query()
      .insert({
        id: "publix",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "publix",
        key: "publix",
        name: "Publix",
        url: "https://www.publix.com/covid-vaccine",
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

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_55km",
        25,
        "country_grid_110km",
        status.reprocessGridIds
      );
    }

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_22km",
        10,
        "country_grid_55km",
        status.reprocessGridIds
      );
    }

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_11km",
        5,
        "country_grid_22km",
        status.reprocessGridIds
      );
    }

    if (status.reprocessGridIds.length > 0) {
      logger.error(
        `Grids still need reprocessing: ${JSON.stringify(
          status.reprocessGridIds
        )}`
      );
      process.exit(1);
    }

    await Store.knex().raw(`
      UPDATE stores s
      SET county_id = c.id
      FROM counties c
      WHERE
        s.provider_id = 'publix'
        AND s.county_id IS NULL
        AND st_intersects(s.location, c.boundaries_500k)
    `);

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
      .whereRaw(
        "grid.centroid_postal_code_state_code IN ('FL', 'GA', 'AL', 'SC', 'TN', 'NC', 'VA')"
      )
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
      if (Stores.processedPostalCodes[gridCell.centroid_postal_code]) {
        logger.info(
          `  Skipping already imported postal code ${gridCell.centroid_postal_code}`
        );
        continue;
      }

      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      const data = await Stores.importStoresInGridCell(gridCell);
      const stores = data.Stores;
      const lastStore = stores[stores.length - 1];
      if (lastStore?.DISTANCE < gridRadiusMiles) {
        logger.info(
          `Last store in search radius was less than ${gridRadiusMiles} miles away (${lastStore?.DISTANCE}), adding grid cell for further reprocessing.`
        );
        reprocessGridIds.push(gridCell.id);
      }

      Stores.processedPostalCodes[gridCell.centroid_postal_code] = true;
    }

    return {
      reprocessGridIds,
    };
  }

  static async importStoresInGridCell(gridCell) {
    await sleep(1000);

    const lastFetched = DateTime.utc().toISO();
    const resp = throwCurlResponseError(
      await curly.get(
        `https://services.publix.com/api/v1/storelocation?${querystring.stringify(
          {
            types: "R,G,H,N,S",
            option: "A",
            includeOpenAndCloseDates: "true",
            zipCode: gridCell.centroid_postal_code,
          }
        )}`,
        defaultCurlOpts
      )
    );

    for (const store of resp.data.Stores) {
      if (Stores.importedStores[store.KEY]) {
        logger.info(`  Skipping already imported store ${store.KEY}`);
        continue;
      }

      logger.info(`  Importing store ${store.KEY}`);

      let timeZone;
      switch (store.STORETIMEZONE) {
        case "Eastern Standard Time":
          timeZone = "America/New_York";
          break;
        case "Central Standard Time":
          timeZone = "America/Chicago";
          break;
        default:
          throw new Error(`Unknown timezone: ${store.STORETIMEZONE}`);
      }

      const patch = {
        provider_id: "publix",
        provider_location_id: store.KEY,
        provider_brand_id: Stores.providerBrand.id,
        name: store.NAME,
        address: store.ADDR,
        city: store.CITY,
        state: store.STATE,
        postal_code: store.ZIP.substr(0, 5),
        time_zone: timeZone,
        location: `point(${store.CLON} ${store.CLAT})`,
        location_source: "provider",
        metadata_raw: { storelocation: store },
        location_metadata_last_fetched: lastFetched,
      };
      patch.brand = patch.provider_id;
      patch.brand_id = patch.provider_location_id;

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge({
          ..._.omit(patch, ["metadata_raw"]),
          metadata_raw: Store.raw(
            "stores.metadata_raw || excluded.metadata_raw"
          ),
        });

      Stores.importedStores[store.KEY] = true;
    }

    return resp.data;
  }
}

module.exports = Stores;
