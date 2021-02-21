const got = require("got");
const sleep = require("sleep-promise");
const { Store } = require("../models/Store");

module.exports.findSamsClubStores = async () => {
  const resp = await got(
    "https://www.samsclub.com/api/node/vivaldi/v2/clubfinder/list",
    {
      searchParams: {
        singleLineAddr: "67123",
        nbrOfStores: "10000",
        distance: "10000",
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      responseType: "json",
      retry: 0,
    }
  );

  for (const store of resp.body) {
    console.info(`  Importing store ${store.id}`);
    await Store.query()
      .insert({
        brand: "sams_club",
        brand_id: store.id,
        name: store.name,
        address: store.address.address1,
        city: store.address.city,
        state: store.address.state,
        postal_code: store.address.postalCode,
        location: `point(${store.geoPoint.longitude} ${store.geoPoint.latitude})`,
        metadata_raw: store,
      })
      .onConflict(["brand", "brand_id"])
      .merge();
  }

  await Store.knex().destroy();
};

module.exports.findSamsClubStores();
