const getDatabase = require('../getDatabase');
const retry = require('async-retry');
const _ = require('lodash');
const walmartAuth = require('../walmart/auth');
const { DateTime, Settings } = require('luxon');
const got = require('got');
const sleep = require('sleep-promise');

Settings.defaultZoneName = 'America/Denver';

module.exports.refreshWalmart = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "walmart_stores" });

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo",
      parameters: [
        { name: '@minsAgo', value: DateTime.utc().minus({ minutes: 2 }).toISO() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i++;
    console.info(`Processing ${resource.displayName} #${resource.id} (${i} of ${resources.length})...`);

    if(!resource.servicesMap || !resource.servicesMap.COVID_IMMUNIZATIONS || !resource.servicesMap.COVID_IMMUNIZATIONS.active) {
      console.info(`  Skipping ${resource.displayName} #${resource.id} since it doesn't currently support COVID vaccines.`);
      continue;
    }

    const lastFetched = DateTime.utc().toISO()

    const resp = await retry(async () => {
      const auth = await walmartAuth.get();
      return await got.post(`https://www.walmart.com/pharmacy/v2/clinical-services/time-slots/${auth.body.payload.cid}`, {
        headers: {
          'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        },
        cookieJar: auth.cookieJar,
        responseType: 'json',
        json: {
          startDate: DateTime.local().toFormat('LLddyyyy'),
          endDate: DateTime.local().plus({ days: 6 }).toFormat('LLddyyyy'),
          imzStoreNumber: {
            USStoreId: parseInt(resource.id, 10),
          },
        },
        retry: 0,
      });
    }, {
      retries: 2,
      onRetry: async (err) => {
        console.info(`Error fetching data (${err.response.statusCode}), attempting to refresh auth and then retry.`);
        await walmartAuth.refresh();
      },
    });

    await container.items.upsert({
      ...resource,
      timeSlots: resp.body,
      lastFetched,
    });

    await sleep(1000);
  }
};

// module.exports.refreshWalmart();
