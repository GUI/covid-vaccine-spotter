const getDatabase = require('../getDatabase');
const RandomHttpUserAgent = require('random-http-useragent')
const got = require('got');
const sleep = require('sleep-promise');
const { HttpsProxyAgent } = require('hpagent')

module.exports.findWalmartStores = async () => {
  const db = await getDatabase();
  const { container: zipCodesContainer } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({ id: "kroger_stores" });

  const importedStores = {};
  let { resources: zipCodeResources } = await zipCodesContainer.items
    .query({
      query: "SELECT * from c ORDER by c.id",
    })
    .fetchAll();
  for (const zipCode of zipCodeResources) {
    console.info(`Importing stores for ${zipCode.zipCode}...`);
    if (zipCode.zipCode < '80826') {
      continue;
    }

    if (zipCode.zipCode === '80826') {
      continue;
    }


    const agent = await RandomHttpUserAgent.get()
    const resp = await got.post('https://www.kingsoopers.com/stores/api/graphql', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36', // agent,
      },
      /*
      agent: {
        https: new HttpsProxyAgent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          maxSockets: 256,
          maxFreeSockets: 256,
          scheduling: 'lifo',
          proxy: 'http://localhost:8080/',
        })
      },
      */
      http2: true,
      /*
      https: {
        rejectUnauthorized: false
      },
      */
      timeout: 5000,
      //throwHttpErrors: false,
      responseType: 'json',
      decompress: true,
      /*
      hooks: {
        beforeRequest: [
          options => {
            console.info('options: ', options);
          }
        ]
      },
      */
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
    // console.info(resp);
    console.info(resp.body);
    /*
    } catch(err) {
      console.info(err);
      console.info(err.response);
      console.info(err.response.body);
      console.info(err.request);
      console.info(err.response.request);
      throw err;
    }
    */

    for (const store of resp.body.data.storeSearch.stores) {
      store.id = `${store.divisionNumber}${store.storeNumber}`;

      if (importedStores[store.id]) {
        console.info(`  Skipping already imported store ${store.id}`);
      } else if (store.address.stateCode !== 'CO') {
        console.info(`  Skipping store in other state: ${store.address.stateCode}`);
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

module.exports.findWalmartStores();
