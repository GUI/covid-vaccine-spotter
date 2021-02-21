const got = require("got");
const sleep = require("sleep-promise");
const getDatabase = require("../getDatabase");

module.exports.findSamsClubStores = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: "sams_club_stores",
  });

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
    store.id = store.id.toString();

    if (store.address.state !== "CO") {
      console.info(
        `  Skipping store in other state ${store.id}: ${store.address.state}`
      );
    } else {
      console.info(`  Importing store ${store.id}`);
      await container.items.upsert(store);

      await sleep(50);
    }
  }
};

module.exports.findSamsClubStores();
