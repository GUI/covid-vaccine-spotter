const _ = require('lodash');
const sleep = require('sleep-promise');
const { DateTime, Settings } = require('luxon');
const dateAdd = require('date-fns/add')
const getDatabase = require('../getDatabase');
const got = require('got');

Settings.defaultZoneName = 'America/Denver';

module.exports.refreshWalgreens = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "walgreens_zip_codes" });

  const tomorrow = DateTime.local().plus({ days: 1 });

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE c.lastFetched = null OR c.lastFetched <= @minsAgo",
      parameters: [
        { name: '@minsAgo', value: DateTime.utc().minus({ minutes: 2 }).toISO() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const zipCode of resources) {
    i++;
    console.info(`Processing ${zipCode.zipCode} (${i} of ${resources.length})...`);

    const lastFetched = DateTime.utc().toISO()

    const resp = await got.post('https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability', {
      headers: {
        // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        'Referer': 'https://www.walgreens.com/findcare/vaccination/covid-19/location-screening',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      json: {
        serviceId: '99',
        position: {
          latitude: parseFloat(zipCode.latitude),
          longitude: parseFloat(zipCode.longitude),
        },
        appointmentAvailability: {
          startDateTime: tomorrow.toISODate(),
        },
        radius:25,
      },
      responseType: 'json',
      retry: 0,
    });

    await container.items.upsert({
      ...zipCode,
      ...resp.body,
      lastFetched,
    });

    await sleep(1000);
  }
}

module.exports.refreshWalgreens();
