const { firefox } = require('playwright-extra')
const _ = require('lodash');
const sleep = require('sleep-promise');
const { DateTime, Settings } = require('luxon');
const getDatabase = require('../getDatabase');
const got = require('got');

Settings.defaultZoneName = 'America/Denver';

const HumanizePlugin = require('@extra/humanize')
firefox.use(
  HumanizePlugin({
    mouse: {
      showCursor: true // Show the cursor (meant for testing)
    }
  })
)

module.exports.refreshKroger = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "kroger_stores" });

  const startDate = DateTime.local();
  const endDate = DateTime.local().plus({ days: 7 });

  const browser = await firefox.launch({
    headless: false,
    devtools: true,
  });

  const page = await browser.newPage()

  page.on('response', async (response) => {
    console.log('XHR response received: ', response.url());
  });

  await page.goto('https://www.kingsoopers.com/rx/covid-vaccine', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });

  await page.click('[aria-label="I Agree"]');
  await sleep(1000);

  const processedFacilityIds = {};
  const processedZipCodes = {};

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE c.vanityName != 'Loaf \\'N Jug' AND NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo",
      parameters: [
        { name: '@minsAgo', value: DateTime.utc().minus({ minutes: 2 }).toISO() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i++;
    const facilityId = `${resource.divisionNumber}${resource.storeNumber}`;
    console.info(`Processing store #${facilityId} (${i} of ${resources.length})...`);
    console.info(resource);
    console.info(resource.address);

    if (processedFacilityIds[facilityId]) {
      console.info(`  Already processed store #${facilityId} as part of earlier request, so skipping.`);
    } else if (processedZipCodes[resource.address.zip]) {
      console.info(`  Already processed zip code ${resource.address.zip} as part of earlier request, so skipping.`);
    }

    const data = await page.evaluate(async (options) => {
      console.info('options: ', options);
      const response = await fetch(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/${options.zipCode}/${options.startDate}/${options.endDate}/50?appointmentReason=122&appointmentReason=125`, {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "rx-channel": "WEB",
          "x-sec-clge-req-type": "ajax"
        },
        //"mode": "cors",
        //"credentials": "include"
      });
      console.log('status: ', response.status);
      console.log('status: ', response.body);
      //console.log('response.text: ', response.text());
      //console.log('response.json: ', response.json());
      console.log('status: ', response);

      return await response.json();
    }, {
      zipCode: resource.address.zip,
      startDate: startDate.toISODate(),
      endDate: endDate.toISODate(),
    });
    console.info('data: ', data);

    for (const location of data) {
      console.info('location: ', location);

      await container.items.upsert({
        ...resource,
        appointments: location,
        lastFetched,
      });

      processedFacilityIds[location.facilityDetails.facilityId] = true;
      processedZipCodes[resource.address.zip] = true;
    }

    await page.click('[data-testid="SiteMenu-HamburgerMenu--Button"]');
    await page.click('[data-testid="SiteMenuContent--CloseButton"]');

    await sleep(1000);
  }
}

module.exports.refreshKroger();
