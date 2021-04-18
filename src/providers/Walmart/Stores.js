const got = require("got");
const { DateTime } = require("luxon");
const sleep = require("sleep-promise");
const { HttpsProxyAgent } = require("hpagent");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    logger.notice("Begin finding stores...");

    await Provider.query()
      .insert({
        id: "walmart",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "walmart",
        key: "walmart",
        name: "Walmart",
        url:
          "https://www.walmart.com/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    Stores.importedStores = {};

    // Search for stores in each 110km grid cell. The 110km grid is normally
    // appropriate for a search radius of 50 miles. But in this case, since the
    // Walmart API only accepts the postal code, and the postal code centroid
    // may not be exactly in the center of the grid cell, we are actually using
    // it for a 100 mile radius search. So while ideally, we'd use a 220km grid
    // cell for the 100 mile radius search, due to the zip code limitations, we
    // need to account for having more buffer in the search radius.
    let status = await Stores.processGrid("country_grid_110km", 100);

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_55km",
        50,
        "country_grid_110km",
        status.reprocessGridIds
      );
    }

    if (status.reprocessGridIds.length > 0) {
      status = await Stores.processGrid(
        "country_grid_22km",
        25,
        "country_grid_55km",
        status.reprocessGridIds
      );
    }

    logger.notice("Finished finding stores.");
  }

  static async processGrid(
    tableName,
    searchRadiusMiles,
    joinGridTableName,
    joinGridIds
  ) {
    const knex = Store.knex();
    let grid = knex
      .select(
        knex.raw(
          "DISTINCT ON (grid.centroid_postal_code) grid.id, grid.centroid_postal_code"
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
          index + 1
        } of ${count})...`
      );

      const data = await Stores.importStoresInGridCell(
        gridCell,
        searchRadiusMiles
      );
      if (data) {
        const { stores } = data.payload.storesData;
        const lastStore = stores[stores.length - 1];
        if (
          stores.length === 50 &&
          lastStore.distance < searchRadiusMiles / 2
        ) {
          logger.info(
            `Limit of 50 stores returned in resposne (${data.payload.storesData.stores.length}), adding grid cell for further reprocessing.`
          );
          reprocessGridIds.push(gridCell.id);
        }
      }
    }

    return {
      reprocessGridIds,
    };
  }

  static async importStoresInGridCell(gridCell, searchRadiusMiles) {
    await sleep(1000);

    const lastFetched = DateTime.utc().toISO();
    const resp = await got(
      "https://www.walmart.com/store/finder/electrode/api/stores",
      {
        searchParams: {
          singleLineAddr: gridCell.centroid_postal_code,
          distance: searchRadiusMiles,
        },
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        responseType: "json",
        timeout: 30000,
        retry: 2,
        throwHttpErrors: false,
        agent: {
          https: new HttpsProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: "lifo",
            proxy: process.env.WALMART_STORES_PROXY_URL,
          }),
        },
        https: {
          rejectUnauthorized: false,
        },
      }
    );

    if (resp.statusCode !== 200) {
      logger.warn(
        `Unsuccessful response, skipping: ${resp.statusCode}: ${resp.body}`
      );
      return null;
    }
    if (!resp?.body?.payload?.storesData?.stores) {
      logger.warn(`Unexpected response body, skipping: ${resp.body}`);
      return null;
    }

    for (const store of resp.body.payload.storesData.stores) {
      if (Stores.importedStores[store.id]) {
        logger.info(`  Skipping already imported store ${store.id}`);
      } else {
        logger.info(`  Importing store ${store.id}`);

        const patch = {
          brand: "walmart",
          brand_id: store.id,
          provider_id: "walmart",
          provider_location_id: store.id,
          provider_brand_id: Stores.providerBrand.id,
          name: store.displayName,
          address: store.address.address,
          city: store.address.city,
          state: store.address.state,
          postal_code: store.address.postalCode,
          time_zone: store.timeZone,
          location: `point(${store.geoPoint.longitude} ${store.geoPoint.latitude})`,
          carries_vaccine: !!store?.servicesMap?.COVID_IMMUNIZATIONS?.active,
          metadata_raw: store,
          location_metadata_last_fetched: lastFetched,
        };

        // This Phenix City, AL store's data say it's in the Central time
        // zone, but it actually uses Eastern time zone, so fix this or else
        // requests for the next day will fail for an hour every night (since
        // we're requesting the previous day).
        // https://en.wikipedia.org/wiki/Phenix_City,_Alabama#Time_zone
        if (
          patch.state === "AL" &&
          patch.city === "Phenix City" &&
          patch.time_zone === "America/Chicago"
        ) {
          patch.time_zone = "America/New_York";
        }

        await Store.query()
          .insert(patch)
          .onConflict(["brand", "brand_id"])
          .merge();

        Stores.importedStores[store.id] = true;
      }
    }

    return resp.body;
  }
}

module.exports = Stores;
