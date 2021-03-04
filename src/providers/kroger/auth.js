require("dotenv").config();

const _ = require("lodash");
const { DateTime } = require("luxon");
const retry = require("p-retry");
const { PlaywrightBlocker } = require("@cliqz/adblocker-playwright");
const sleep = require("sleep-promise");
const { firefox } = require("playwright-extra");
const fetch = require("cross-fetch");
const HumanizePlugin = require("@extra/humanize");
const logger = require("../../logger");

firefox.use(
  HumanizePlugin({
    mouse: {
      showCursor: true, // Show the cursor (meant for testing)
    },
  })
);

class KrogerAuth {
  static async get() {
    if (KrogerAuth.auth) {
      return KrogerAuth.auth;
    }
    return KrogerAuth.refresh();
  }

  static async ensureBrowserClosed() {
    if (KrogerAuth.moveCursorTimeout) {
      clearTimeout(KrogerAuth.moveCursorTimeout);
      KrogerAuth.moveCursorTimeout = undefined;
    }
    if (KrogerAuth.page) {
      await KrogerAuth.page.close();
      KrogerAuth.page = undefined;
    }
    if (KrogerAuth.context) {
      await KrogerAuth.context.close();
      KrogerAuth.context = undefined;
    }
    if (KrogerAuth.browser) {
      await KrogerAuth.browser.close();
      KrogerAuth.browser = undefined;
    }
  }

  static async refresh() {
    let attempt = 0;
    const auth = await retry(
      async () => {
        attempt += 1;
        logger.info(`Refreshing Kroger auth (attempt ${attempt})`);

        await KrogerAuth.ensureBrowserClosed();
        KrogerAuth.browser = await firefox.launch({
          headless: true,
          /*
          proxy: {
            server: process.env.PROXY_RANDOM_SERVER,
            username: process.env.PROXY_RANDOM_USERNAME,
            password: process.env.PROXY_RANDOM_PASSWORD,
          },
          */
        });
        KrogerAuth.context = await KrogerAuth.browser.newContext({
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
        });
        KrogerAuth.page = await KrogerAuth.context.newPage();

        const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(
          fetch
        );
        await blocker.enableBlockingInPage(KrogerAuth.page);

        blocker.on("request-blocked", (request) => {
          logger.debug("blocked", request.url);
        });

        logger.info("Navigating to initial page...");
        await KrogerAuth.page.goto(
          "https://www.kingsoopers.com/rx/covid-eligibility",
          {
            waitUntil: "domcontentloaded",
          }
        );

        logger.info("Waiting for buttons...");
        await KrogerAuth.page.waitForSelector('button[aria-label="I Agree"]');
        await retry(
          async () => {
            await KrogerAuth.page.waitForSelector(
              'button[aria-label="I Agree"]'
            );
            await KrogerAuth.page.click('button[aria-label="I Agree"]', {
              delay: _.random(1, 15),
            });
            await KrogerAuth.page.waitForSelector(
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
        await KrogerAuth.page.waitForLoadState("networkidle");
        await sleep(_.random(250, 750));
        logger.info("Starting cursor movement...");
        KrogerAuth.moveCursorTimeout = setTimeout(KrogerAuth.moveCursor, 1);
        await sleep(_.random(250, 750));

        logger.info("Making test ajax request");
        const startDate = DateTime.now().setZone("America/Denver");
        const endDate = startDate.plus({ days: 7 });
        const resp = await KrogerAuth.page.evaluate(
          async (options) => {
            const response = await fetch(
              `https://www.kingsoopers.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/${options.zipCode}/${options.startDate}/${options.endDate}/50?appointmentReason=122&appointmentReason=125`,
              {
                headers: {
                  accept: "application/json, text/plain, */*",
                  "cache-control": "no-cache",
                  pragma: "no-cache",
                  "rx-channel": "WEB",
                  "x-sec-clge-req-type": "ajax",
                },
              }
            );

            return {
              url: response.url,
              statusCode: response.status,
              headers: response.headers,
              body: await response.text(),
            };
          },
          {
            zipCode: "80401",
            startDate: startDate.toISODate(),
            endDate: endDate.toISODate(),
          }
        );

        if (resp.statusCode === 428) {
          logger.info(resp);
          throw new Error("Invalid test response.");
        }

        logger.info("Checking for visible captcha...");
        if (await KrogerAuth.page.isVisible("#sec-overlay")) {
          logger.info("Visible captcha detected.");
          throw new Error("Captcha detected");
        }

        logger.info("Returning auth...");
        return {
          context: KrogerAuth.context,
          page: KrogerAuth.page,
        };
      },
      {
        retries: 100,
      }
    );

    logger.info("Setting auth...");
    KrogerAuth.set(auth);
    logger.info("Finished auth refresh.");

    return auth;
  }

  static async set(auth) {
    KrogerAuth.auth = auth;
  }

  static async moveCursor() {
    logger.info("move cursor");
    if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
      KrogerAuth.moveCursorTimeout = setTimeout(
        KrogerAuth.moveCursor,
        _.random(250, 750)
      );
      return;
    }

    if (KrogerAuth.page && (await KrogerAuth.page.isVisible("#sec-overlay"))) {
      KrogerAuth.moveCursorTimeout = setTimeout(
        KrogerAuth.moveCursor,
        _.random(250, 750)
      );
      logger.info("OVERLAY! SKIPPING!");
      return;
    }

    await retry(
      async () => {
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.waitForSelector(
          '[data-testid="SiteMenuContent--CloseButton"]',
          {
            state: "hidden",
            timeout: 5000,
          }
        );
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.click(
          '[data-testid="SiteMenu-HamburgerMenu--Button"]',
          {
            delay: _.random(1, 15),
            timeout: 5000,
          }
        );
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.waitForSelector(
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
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.click(
          '[data-testid="SiteMenuContent--CloseButton"]',
          {
            delay: _.random(1, 15),
            timeout: 5000,
          }
        );
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.waitForSelector(
          '[data-testid="SiteMenuContent--CloseButton"]',
          {
            state: "hidden",
            timeout: 5000,
          }
        );
        if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
          return;
        }
        await KrogerAuth.page.waitForSelector(
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

    KrogerAuth.moveCursorTimeout = setTimeout(
      KrogerAuth.moveCursor,
      _.random(250, 750)
    );
  }
}

module.exports = KrogerAuth;
