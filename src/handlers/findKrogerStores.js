const getDatabase = require("../getDatabase");
const RandomHttpUserAgent = require("random-http-useragent");
const got = require("got");
const sleep = require("sleep-promise");
const { HttpsProxyAgent } = require("hpagent");

module.exports.findKrogerStores = async () => {
  const db = await getDatabase();
  const {
    container: zipCodesContainer,
  } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({
    id: "kroger_stores",
  });

  const tokenResponse = await got.post(
    "https://api.kroger.com/v1/connect/oauth2/token",
    {
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      username: process.env.KROGER_CLIENT_ID,
      password: process.env.KROGER_CLIENT_SECRET,
      responseType: "json",
      form: {
        grant_type: "client_credentials",
      },
      retry: 0,
    }
  );

  const importedStores = {};
  let { resources: zipCodeResources } = await zipCodesContainer.items
    .query({
      query: "SELECT * from c ORDER by c.id",
    })
    .fetchAll();
  for (const zipCode of zipCodeResources) {
    console.info(`Importing stores for ${zipCode.zipCode}...`);

    const resp = await got.get("https://api.kroger.com/v1/locations", {
      searchParams: {
        "filter.zipCode.near": zipCode.zipCode,
        "filter.radiusInMiles": 100,
        "filter.limit": 200,
        "filter.department": "09",
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        Authorization: `Bearer ${tokenResponse.body.access_token}`,
      },
      responseType: "json",
      retry: 0,
    });

    for (const store of resp.body.data) {
      store.id = `${store.locationId}`;

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

    await sleep(50);
  }
};

module.exports.findKrogerStores();
