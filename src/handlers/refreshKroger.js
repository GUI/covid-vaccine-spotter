const { firefox } = require('playwright-extra');
const retry = require('async-retry');
const _ = require('lodash');
const sleep = require('sleep-promise');
const { DateTime, Settings } = require('luxon');
const getDatabase = require('../getDatabase');
const got = require('got');

Settings.defaultZoneName = 'America/Denver';

const HumanizePlugin = require('@extra/humanize');

firefox.use(
  HumanizePlugin({
    mouse: {
      showCursor: true, // Show the cursor (meant for testing)
    },
  })
);

async function initBrowserPage(browser) {
  let context;
  let page;

  await retry(
    async () => {
      console.info('Initializing new browser context and page...');

      if (context) {
        console.info('Closing context and trying again');
        await context.close();
      }

      context = await browser.newContext();
      page = await browser.newPage();

      await page.goto('https://akamai.com', { waitUntil: 'load' });
      await page.goto('https://www.kingsoopers.com/', { waitUntil: 'load' });
      await page.waitForSelector('[href="/i/coronavirus-update/vaccine"]');
      await page.click('[href="/i/coronavirus-update/vaccine"]');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[href="/rx/covid-eligibility"]');
      await page.click('[href="/rx/covid-eligibility"]');
      await page.waitForLoadState('networkidle');
      if (await page.isVisible('#sec-overlay')) {
        console.info('OVERLAY!');
        throw 'Captcha detected';
      }
      await retry(
        async () => {
          await page.waitForSelector('button[aria-label="I Agree"]');
          await page.click('button[aria-label="I Agree"]', {
            delay: _.random(1, 15),
          });
          await page.waitForSelector(
            'button[aria-label="No"]:not(.pointer-event-none)',
            {
              timeout: 5000,
            }
          );
        },
        {
          retries: 3,
          minTimeout: 5,
          maxTimeout: 20,
        }
      );
    },
    {
      retries: 10,
      minTimeout: 1000,
      maxTimeout: 10000,
      onRetry: (err) => {
        console.info('initBrowserPage Error: ', err);
      },
    }
  );

  return { context, page };
}

module.exports.refreshKroger = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: 'kroger_stores',
  });

  const startDate = DateTime.local();
  const endDate = DateTime.local().plus({ days: 7 });

  const browser = await firefox.launch({
    headless: false,
    devtools: true,
  });

  let { context, page } = await initBrowserPage(browser);

  while (true) {
    console.info(`Starting processing: ${new Date()}`);

    const processedFacilityIds = {};
    const processedZipCodes = {};

    let { resources } = await container.items
      .query({
        query:
          'SELECT * from c WHERE NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo ORDER BY c.id',
        parameters: [
          {
            name: '@minsAgo',
            value: DateTime.utc().minus({ minutes: 2 }).toISO(),
          },
        ],
      })
      .fetchAll();
    resources = _.shuffle(resources);
    let i = 0;
    for (const resource of resources) {
      i += 1;
      console.info(
        `Processing store #${resource.id} (${i} of ${resources.length})...`
      );

      if (processedFacilityIds[resource.id]) {
        console.info(
          `  Skipping already processed store #${resource.id} as part of earlier request.`
        );
        continue;
      } else if (processedZipCodes[resource.address.zipCode]) {
        console.info(
          `  Skipping already processed zip code ${resource.address.zipCode} as part of earlier request.`
        );
        continue;
      }

      const lastFetched = DateTime.utc().toISO();

      let data = [];
      let reopen = false;
      await retry(
        async () => {
          console.info('attempt');
          if (reopen) {
            await page.close();
            await context.close();
            ({ context, page } = await initBrowserPage(browser));
            reopen = false;
          }

          data = await page.evaluate(
            async (options) => {
              const response = await fetch(
                `https://www.kingsoopers.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/${options.zipCode}/${options.startDate}/${options.endDate}/50?appointmentReason=122&appointmentReason=125`,
                {
                  headers: {
                    accept: 'application/json, text/plain, */*',
                    'cache-control': 'no-cache',
                    pragma: 'no-cache',
                    'rx-channel': 'WEB',
                    'x-sec-clge-req-type': 'ajax',
                  },
                }
              );

              return response.json();
            },
            {
              zipCode: resource.address.zipCode,
              startDate: startDate.toISODate(),
              endDate: endDate.toISODate(),
            }
          );

          if (!Array.isArray(data)) {
            throw `Data not an array: ${JSON.stringify(data)}`;
          }
        },
        {
          retries: 10,
          minTimeout: 60 * 1000,
          maxTimeout: 5 * 60 * 1000,
          onRetry: (err) => {
            console.info('Data fetch error: ', err);
            reopen = true;
          },
        }
      );

      for (const appointments of data) {
        const appointmentsStoreId = appointments.loc_no.replace(/^625/, '620');
        console.info(
          `  Processing appointment results for store #${appointmentsStoreId}`
        );

        if (appointments.facilityDetails.address.state !== 'CO') {
          console.info(
            `  Skipping appointment result #${appointmentsStoreId} for being out of state: ${appointments.facilityDetails.address.state}.`
          );
          continue;
        }

        const { resource: appointmentsStoreResource } = await container
          .item(appointmentsStoreId)
          .read();
        if (!appointmentsStoreResource) {
          throw `Store not found for ${appointments.loc_no}`;
        }

        await container.items.upsert({
          ...appointmentsStoreResource,
          appointments,
          lastFetched,
        });

        processedFacilityIds[appointmentsStoreId] = true;
        await sleep(50);
      }

      processedZipCodes[resource.address.zipCode] = true;

      await retry(
        async () => {
          await page.waitForSelector(
            '[data-testid="SiteMenuContent--CloseButton"]',
            {
              state: 'hidden',
              timeout: 5000,
            }
          );
          await page.click('[data-testid="SiteMenu-HamburgerMenu--Button"]', {
            delay: _.random(1, 15),
            timeout: 5000,
          });
          await page.waitForSelector(
            '[data-testid="SiteMenuContent--CloseButton"]',
            {
              timeout: 5000,
            }
          );
        },
        {
          retries: 5,
          minTimeout: 50,
          maxTimeout: 500,
        }
      );
      await sleep(_.random(100, 200));
      await retry(
        async () => {
          await page.click('[data-testid="SiteMenuContent--CloseButton"]', {
            delay: _.random(1, 15),
            timeout: 5000,
          });
          await page.waitForSelector(
            '[data-testid="SiteMenuContent--CloseButton"]',
            {
              state: 'hidden',
              timeout: 5000,
            }
          );
          await page.waitForSelector(
            '[data-testid="SiteMenu-HamburgerMenu--Button"]',
            {
              timeout: 5000,
            }
          );
        },
        {
          retries: 5,
          minTimeout: 50,
          maxTimeout: 500,
        }
      );
    }

    console.info(`Finished processing: ${new Date()}`);
  }
};

module.exports.refreshKroger();
