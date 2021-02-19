const { firefox } = require('playwright-extra')
const retry = require('async-retry');
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

const RecaptchaPlugin = require('@extra/recaptcha');
const RecaptchaOptions = {
  visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
  provider: {
    id: '2captcha',
    token: process.env.CAPTCHA_API_KEY,
  },
}
firefox.use(RecaptchaPlugin(RecaptchaOptions))

module.exports.refreshKroger = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "kroger_stores" });

  const startDate = DateTime.local();
  const endDate = DateTime.local().plus({ days: 7 });

  const browser = await firefox.launch({
    headless: false,
    devtools: true,
  });

  while(true) {
    console.info(`Starting processing: ${new Date()}`);

    const page = await browser.newPage()

    await retry(async () => {
      await page.goto('https://www.kingsoopers.com/rx/covid-vaccine', { waitUntil: 'networkidle' });
      await page.reload({ waitUntil: 'networkidle' });

      await page.solveRecaptchas();
      for (const frame of page.mainFrame().childFrames()) {
        await frame.solveRecaptchas()
      }
      if (page.isVisible('#sec-overlay')) {
        await sleep(1000);
        page.evaluate('document.getElementById("sec-overlay").style.display = "none";');
      }

      await page.click('[aria-label="I Agree"]', {
        delay: _.random(1, 15),
      });
      await sleep(1000);

      const processedFacilityIds = {};
      const processedZipCodes = {};

      let { resources } = await container.items
        .query({
          query: "SELECT * from c WHERE NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo ORDER BY c.id",
          parameters: [
            { name: '@minsAgo', value: DateTime.utc().minus({ minutes: 2 }).toISO() },
          ],
        })
        .fetchAll();
      resources = _.shuffle(resources);
      let i = 0;
      for (const resource of resources) {
        i++;
        console.info(`Processing store #${resource.id} (${i} of ${resources.length})...`);

        if (processedFacilityIds[resource.id]) {
          console.info(`  Skipping already processed store #${resource.id} as part of earlier request.`);
          continue;
        } else if (processedZipCodes[resource.address.zipCode]) {
          console.info(`  Skipping already processed zip code ${resource.address.zipCode} as part of earlier request.`);
          continue;
        }

        const lastFetched = DateTime.utc().toISO();

        let data;
        await retry(async () => {
          console.info('inner Trying to solve captchas');
          await page.solveRecaptchas();
          for (const frame of page.mainFrame().childFrames()) {
            await frame.solveRecaptchas()
          }
          if (await page.isVisible('#sec-overlay')) {
            console.info('inner visible');
            await page.waitForSelector('#sec-overlay', {
              state: 'hidden',
            });
            // await sleep(5000000);
            // page.evaluate('document.getElementById("sec-overlay").style.display = "none";');
          }

          data = await page.evaluate(async (options) => {
            const response = await fetch(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/${options.zipCode}/${options.startDate}/${options.endDate}/50?appointmentReason=122&appointmentReason=125`, {
              "headers": {
                "accept": "application/json, text/plain, */*",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "rx-channel": "WEB",
                "x-sec-clge-req-type": "ajax"
              },
            });

            return await response.json();
          }, {
            zipCode: resource.address.zipCode,
            startDate: startDate.toISODate(),
            endDate: endDate.toISODate(),
          });

          if (!Array.isArray(data)) {
            throw `Data not an array: ${JSON.stringify(data)}`;
          }
        }, {
          retries: 2,
          onRetry: async (err) => {
            console.info('inner retry err: ', err);
          },
        });

        for (const appointments of data) {
          const appointmentsStoreId = appointments.loc_no.replace(/^625/, '620');
          console.info(`  Processing appointment results for store #${appointmentsStoreId}`);

          if (appointments.facilityDetails.address.state !== 'CO') {
            console.info(`  Skipping appointment result #${appointmentsStoreId} for being out of state: ${appointments.facilityDetails.address.state}.`);
            continue;
          }

          const { resource: appointmentsStoreResource } = await container.item(appointmentsStoreId).read();
          if (!appointmentsStoreResource) {
            throw `Store not found for ${appointments.loc_no}`;
          }

          await container.items.upsert({
            ...appointmentsStoreResource,
            appointments: appointments,
            lastFetched,
          });

          processedFacilityIds[appointmentsStoreId] = true;
          processedZipCodes[resource.address.zipCode] = true;
          await sleep(50);
        }

        await retry(async () => {
          await page.waitForSelector('[data-testid="SiteMenuContent--CloseButton"]', {
            state: 'hidden',
            timeout: 5000,
          });
          await page.click('[data-testid="SiteMenu-HamburgerMenu--Button"]', {
            delay: _.random(1, 15),
            timeout: 5000,
          });
          await page.waitForSelector('[data-testid="SiteMenuContent--CloseButton"]', {
            timeout: 5000,
          });
        }, {
          retries: 2,
        });
        await sleep(_.random(100, 200));
        await retry(async () => {
          await page.click('[data-testid="SiteMenuContent--CloseButton"]', {
            delay: _.random(1, 15),
            timeout: 5000,
          });
          await page.waitForSelector('[data-testid="SiteMenuContent--CloseButton"]', {
            state: 'hidden',
            timeout: 5000,
          });
          await page.waitForSelector('[data-testid="SiteMenu-HamburgerMenu--Button"]', {
            timeout: 5000,
          });
        }, {
          retries: 2,
        });

        await sleep(1000);
      }
    }, {
      retries: 2,
      onRetry: async (err) => {
        console.info('outer retry err: ', err);
        /*
        console.info('outer Trying to solve captchas');
        await page.solveRecaptchas();
        for (const frame of page.mainFrame().childFrames()) {
          await frame.solveRecaptchas()
        }
        await sleep(60000);
        if (await page.isVisible('#sec-overlay')) {
          //await sleep(60000);
          page.evaluate('document.getElementById("sec-overlay").style.display = "none";');
        }
        */
      },
    });

    await page.close();

    console.info(`Finished processing: ${new Date()}`);

    await sleep(_.random(10000, 40000));
  }
}

module.exports.refreshKroger();
