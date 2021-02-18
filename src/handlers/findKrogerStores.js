const getDatabase = require('../getDatabase');
const got = require('got');
const sleep = require('sleep-promise');
const ZipCode = require('../models/ZipCode');
const KrogerStore = require('../models/KrogerStore');

module.exports.findWalmartStores = async () => {
  const db = await getDatabase();
  const { container: zipCodesContainer } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({ id: "kroger_stores" });

  const zipCodes = await ZipCode.scan()
  console.info(zipCodes);
  for (const zipCode of zipCodes) {
    console.info(`Importing stores for ${zipCode.zipCode}...`);
    console.info(zipCode);
    continue;

    const resp = await got.post('https://www.kingsoopers.com/stores/api/graphql', {
      searchParams: {
        singleLineAddr: zipCode.zipCode,
        distance: '100',
      },
      headers: {
        'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      },
      responseType: 'json',
      json: {
        query: '\n' +
          '      query storeSearch($searchText: String!, $filters: [String]!) {\n' +
          '        storeSearch(searchText: $searchText, filters: $filters) {\n' +
          '          stores {\n' +
          '            ...storeSearchResult\n' +
          '          }\n' +
          '          fuel {\n' +
          '            ...storeSearchResult\n' +
          '          }\n' +
          '          shouldShowFuelMessage\n' +
          '        }\n' +
          '      }\n' +
          '      \n' +
          '  fragment storeSearchResult on Store {\n' +
          '    banner\n' +
          '    vanityName\n' +
          '    divisionNumber\n' +
          '    storeNumber\n' +
          '    phoneNumber\n' +
          '    showWeeklyAd\n' +
          '    showShopThisStoreAndPreferredStoreButtons\n' +
          '    storeType\n' +
          '    distance\n' +
          '    latitude\n' +
          '    longitude\n' +
          '    tz\n' +
          '    ungroupedFormattedHours {\n' +
          '      displayName\n' +
          '      displayHours\n' +
          '      isToday\n' +
          '    }\n' +
          '    address {\n' +
          '      addressLine1\n' +
          '      addressLine2\n' +
          '      city\n' +
          '      countryCode\n' +
          '      stateCode\n' +
          '      zip\n' +
          '    }\n' +
          '    pharmacy {\n' +
          '      phoneNumber\n' +
          '    }\n' +
          '    departments {\n' +
          '      code\n' +
          '    }\n' +
          '    fulfillmentMethods{\n' +
          '      hasPickup\n' +
          '      hasDelivery\n' +
          '    }\n' +
          '  }\n',
        variables: {
          searchText: zipCode.zipCode,
          filters: [],
        },
        operationName: 'storeSearch',
      },
      retry: 0,
    });

    /*
    for (const store of resp.body.payload.storesData.stores) {
      store.id = store.id.toString();

      if (importedStores[store.id]) {
        console.info(`  Skipping already imported store ${store.id}`);
      } else if (store.address.state !== 'CO') {
        console.info(`  Skipping store in other state: ${store.address.state}`);
      } else {
        console.info(`  Importing store ${store.id}`);
        await container.items.upsert(store);

        importedStores[store.id] = true

        await sleep(50);
      }
    }
    */

    await sleep(100000);
  }
}

module.exports.findWalmartStores();
