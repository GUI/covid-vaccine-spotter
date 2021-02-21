const got = require("got");
const sleep = require("sleep-promise");
const getDatabase = require("../getDatabase");

module.exports.findWalmartStores = async () => {
  const db = await getDatabase();
  const {
    container: zipCodesContainer,
  } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({
    id: "walmart_stores",
  });

  const importedStores = {};
  const { resources: zipCodeResources } = await zipCodesContainer.items
    .query({
      query: "SELECT * from c ORDER by c.id",
    })
    .fetchAll();
  for (const zipCode of zipCodeResources) {
    console.info(`Importing stores for ${zipCode.zipCode}...`);

    const resp = await got(
      "https://www.walmart.com/store/finder/electrode/api/stores",
      {
        searchParams: {
          singleLineAddr: zipCode.zipCode,
          distance: "100",
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
        console.info(`  Skipping already imported store ${store.id}`);
      } else if (store.address.state !== "CO") {
        console.info(`  Skipping store in other state: ${store.address.state}`);
      } else {
        console.info(`  Importing store ${store.id}`);
        await container.items.upsert(store);

        importedStores[store.id] = true;

        await sleep(50);
      }
    }

    await sleep(1000);
  }
};

module.exports.findWalmartStores();
