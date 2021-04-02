const got = require("got");
const sleep = require("sleep-promise");
const { HttpsProxyAgent } = require("hpagent");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    logger.notice("Begin finding stores...");

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "walmart",
    });

    const importedStores = {};

    const knex = Store.knex();
    const grid = await knex
      .select(knex.raw("centroid_postal_code"))
      .from("country_grid_110km")
      .orderBy("centroid_postal_code");
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          index + 1
        } of ${count})...`
      );

      const resp = await got(
        "https://www.walmart.com/store/finder/electrode/api/stores",
        {
          searchParams: {
            singleLineAddr: gridCell.centroid_postal_code,
            distance: "50",
          },
          headers: {
            "User-Agent":
              "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          },
          responseType: "json",
          timeout: 30000,
          retry: 0,
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

      for (const store of resp.body.payload.storesData.stores) {
        if (importedStores[store.id]) {
          logger.info(`  Skipping already imported store ${store.id}`);
        } else {
          logger.info(`  Importing store ${store.id}`);

          const patch = {
            brand: "walmart",
            brand_id: store.id,
            provider_id: "walmart",
            provider_location_id: store.id,
            provider_brand_id: providerBrand.id,
            name: store.displayName,
            address: store.address.address,
            city: store.address.city,
            state: store.address.state,
            postal_code: store.address.postalCode,
            time_zone: store.timeZone,
            location: `point(${store.geoPoint.longitude} ${store.geoPoint.latitude})`,
            carries_vaccine: !!store?.servicesMap?.COVID_IMMUNIZATIONS?.active,
            metadata_raw: store,
          };

          // This Phenix City, AL store's data say it's in the Central time
          // zone, but it actually uses Eastern time zone, so fix this or else
          // requests for the next day will fail for an hour every night (since
          // we're requesting the previous day).
          // https://en.wikipedia.org/wiki/Phenix_City,_Alabama#Time_zone
          if (
            patch.state === "AL" &&
            patch.city === "Phoenix City" &&
            patch.time_zone === "America/Chicago"
          ) {
            patch.time_zone = "America/New_York";
          }

          await Store.query()
            .insert(patch)
            .onConflict(["brand", "brand_id"])
            .merge();

          importedStores[store.id] = true;
        }
      }

      await sleep(1000);
    }

    logger.notice("Finished finding stores.");
  }
}

module.exports = Stores;
