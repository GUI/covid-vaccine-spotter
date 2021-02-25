const sleep = require("sleep-promise");
const got = require("got");
const logger = require("../logger");
const { Store } = require("../models/Store");

module.exports.findWalmartStores = async () => {
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
        retry: 0,
      }
    );

    for (const store of resp.body.payload.storesData.stores) {
      store.id = store.id.toString();

      if (importedStores[store.id]) {
        logger.info(`  Skipping already imported store ${store.id}`);
      } else {
        logger.info(`  Importing store ${store.id}`);
        await Store.query()
          .insert({
            brand: "walmart",
            brand_id: store.id,
            name: store.displayName,
            address: store.address.address,
            city: store.address.city,
            state: store.address.state,
            postal_code: store.address.postalCode,
            location: `point(${store.geoPoint.longitude} ${store.geoPoint.latitude})`,
            metadata_raw: store,
          })
          .onConflict(["brand", "brand_id"])
          .merge();

        importedStores[store.id] = true;
      }
    }

    await sleep(1000);
  }

  await Store.knex().destroy();
};

module.exports.findWalmartStores();
