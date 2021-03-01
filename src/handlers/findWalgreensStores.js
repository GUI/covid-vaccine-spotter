const sleep = require("sleep-promise");
const got = require("got");
const logger = require("../logger");
const { Store } = require("../models/Store");

module.exports.findWalgreensStores = async () => {
  const importedStores = {};

  const knex = Store.knex();
  const grid = await knex
    .select(
      knex.raw(
        "centroid_postal_code, st_y(centroid_location::geometry) AS latitude, st_x(centroid_location::geometry) AS longitude"
      )
    )
    .from("country_grid_110km")
    .orderBy("centroid_postal_code");
  const count = grid.length;
  for (const [index, gridCell] of grid.entries()) {
    logger.info(
      `Importing stores for ${gridCell.centroid_postal_code} (${
        index + 1
      } of ${count})...`
    );

    const resp = await got.post(
      "https://www.walgreens.com/locator/v1/stores/search",
      {
        searchParams: {
          requestor: "search",
        },
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        },
        responseType: "json",
        json: {
          r: "50",
          requestType: "dotcom",
          s: "1000",
          p: 1,
          // address: '',
          // q: '',
          lat: gridCell.latitude,
          lng: gridCell.longitude,
          // zip: '',
        },
        timeout: 30000,
        retry: 0,
      }
    );
    if (resp.body && !resp.body.results) {
      console.info("  Skipping no results");
      console.info(resp.body);
      await sleep(1000);
      continue;
    }

    for (const store of resp.body.results) {
      store.id = store.storeNumber;

      if (importedStores[store.storeNumber]) {
        logger.info(`  Skipping already imported store ${store.storeNumber}`);
      } else {
        logger.info(`  Importing store ${store.storeNumber}`);
        let timeZone;
        switch (store.store.timeZone) {
          case "AT":
            timeZone = "America/Puerto_Rico";
            break;
          case "EA":
            timeZone = "America/New_York";
            break;
          case "CE":
            timeZone = "America/Chicago";
            break;
          case "MO":
            timeZone = "America/Denver";
            break;
          case "PA":
            timeZone = "America/Los_Angeles";
            break;
          case "AL":
            timeZone = "America/Anchorage";
            break;
          case "HA":
            timeZone = "Pacific/Honolulu";
            break;
          default:
            throw new Error(`Unknown timezone: ${store.store.timeZone}`);
        }

        if (
          store.store.address.zip === "02986" &&
          store.store.address.state === "RI" &&
          store.store.address.city === "NORTH SMITHFIELD"
        ) {
          store.store.address.zip = "02896";
        }

        await Store.query()
          .insert({
            brand: "walgreens",
            brand_id: store.storeNumber,
            name: store.store.name,
            address: store.store.address.street,
            city: store.store.address.city,
            state: store.store.address.state,
            postal_code: store.store.address.zip,
            location: `point(${store.longitude} ${store.latitude})`,
            metadata_raw: store,
            time_zone: timeZone,
          })
          .onConflict(["brand", "brand_id"])
          .merge();

        importedStores[store.storeNumber] = true;
      }
    }

    if (resp.body.summary.hasMoreResult !== false) {
      throw new Error("More results, but pagination not implemented.");
    }

    await sleep(1000);
  }

  await Store.knex().destroy();
};

module.exports.findWalgreensStores();
