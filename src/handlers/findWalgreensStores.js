const getDatabase = require('../getDatabase');
const got = require('got');
const sleep = require('sleep-promise');

module.exports.findWalgreensStores = async () => {
  const db = await getDatabase();
  const { container: zipCodesContainer } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({ id: "walgreens_stores" });

  const importedStores = {};
  let { resources: zipCodeResources } = await zipCodesContainer.items
    .query({
      query: "SELECT * from c ORDER by c.id",
    })
    .fetchAll();
  for (const zipCode of zipCodeResources) {
    console.info(`Importing stores for ${zipCode.zipCode}...`);
    if (zipCode.zipCode < '80721') {
      continue;
    }

    const resp = await got.post('https://www.walgreens.com/locator/v1/stores/search', {
      searchParams: {
        requestor: 'search',
      },
      headers: {
        'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      },
      responseType: 'json',
      json: {
        r: '50',
        requestType: 'dotcom',
        s: '100',
        p: 1,
        // address: '',
        // q: '',
        lat: zipCode.latitude,
        lng: zipCode.longitude,
        // zip: '',
      },
      retry: 0,
    });
    if (resp.body && !resp.body.results) {
      console.info('  Skipping no results');
      console.info(resp.body);
      await sleep(1000);
      continue;
    }

    for (const store of resp.body.results) {
      store.id = store.storeNumber;

      if (importedStores[store.id]) {
        console.info(`  Skipping already imported store ${store.id}`);
      } else if (store.store.address.state !== 'CO') {
        console.info(`  Skipping store in other state: ${store.store.address.state}`);
      } else {
        console.info(`  Importing store ${store.id}`);
        await container.items.upsert(store);

        importedStores[store.id] = true

        await sleep(50);
      }
    }

    await sleep(1000);
  }
}

module.exports.findWalgreensStores();
