require("dotenv").config();

const util = require("util");
const _ = require("lodash");
const retry = require("p-retry");
const { Cookie, CookieJar } = require("tough-cookie");
const RecaptchaPlugin = require("@extra/recaptcha");
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

const KrogerAuth = {
  get: async () => {
    if (KrogerAuth.auth) {
      return KrogerAuth.auth;
    }
    return KrogerAuth.refresh();
  },

  refresh: async () => {
    logger.info("Refreshing Kroger auth");

    const cookieJar = new CookieJar();
    let body;

    if (!KrogerAuth.browser) {
      KrogerAuth.browser = await firefox.launch({
        headless: false,
        /*
        proxy: {
          server: process.env.PROXY_RANDOM_SERVER,
          username: process.env.PROXY_RANDOM_USERNAME,
          password: process.env.PROXY_RANDOM_PASSWORD,
        },
        */
      });
    }
    if (KrogerAuth.moveCursorTimeout) {
      clearTimeout(KrogerAuth.moveCursorTimeout);
    }
    if (KrogerAuth.page) {
      KrogerAuth.page.close();
    }
    if (KrogerAuth.context) {
      KrogerAuth.context.close();
    }

    KrogerAuth.context = await KrogerAuth.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
    });
    KrogerAuth.page = await KrogerAuth.context.newPage();

    const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
    await blocker.enableBlockingInPage(KrogerAuth.page);

    blocker.on("request-blocked", (request) => {
      logger.debug("blocked", request.url);
    });

    logger.info("Navigating to login page...");
    /*
    await KrogerAuth.page.goto(
      "https://www.kingsoopers.com/rx/covid-eligibility",
      {
        waitUntil: "domcontentloaded",
      }
    );
    */
    await KrogerAuth.page.goto("https://akamai.com", { waitUntil: "load" });
    await KrogerAuth.page.goto("https://www.kingsoopers.com/", { waitUntil: "load" });
    await KrogerAuth.page.waitForSelector('[href="/i/coronavirus-update/vaccine"]');
    await KrogerAuth.page.click('[href="/i/coronavirus-update/vaccine"]');
    await KrogerAuth.page.waitForLoadState("networkidle");
    await KrogerAuth.page.waitForSelector('[href="/rx/covid-eligibility"]');
    await KrogerAuth.page.click('[href="/rx/covid-eligibility"]');
    await KrogerAuth.page.waitForLoadState("networkidle");
    if (await KrogerAuth.page.isVisible("#sec-overlay")) {
      console.info("OVERLAY!");
      throw "Captcha detected";
    }
    await retry(
      async () => {
        await KrogerAuth.page.waitForSelector('button[aria-label="I Agree"]');
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

    /*
    await KrogerAuth.page.waitForSelector('button[aria-label="I Agree"]');
    await retry(
      async () => {
        await KrogerAuth.page.waitForSelector('button[aria-label="I Agree"]');
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
    */
    await KrogerAuth.page.waitForLoadState("networkidle");

    if (await KrogerAuth.page.isVisible("#sec-overlay")) {
      console.info("OVERLAY!");
      throw "Captcha detected";
    } else {
      console.info("NO OVERLAY!");
    }

    KrogerAuth.moveCursorTimeout = setTimeout(KrogerAuth.moveCursor, 1);

    await sleep(1000);

    const auth = {
      context: KrogerAuth.context,
      page: KrogerAuth.page,
    };
    KrogerAuth.set(auth);

    return auth;
  },

  set: (auth) => {
    KrogerAuth.auth = auth;
  },

  moveCursor: async () => {
    if (!KrogerAuth.page || KrogerAuth.page.isClosed()) {
      KrogerAuth.moveCursorTimeout = setTimeout(KrogerAuth.moveCursor, _.random(250, 750));
      return;
    }

    if (await KrogerAuth.page.isVisible("#sec-overlay")) {
      KrogerAuth.moveCursorTimeout = setTimeout(KrogerAuth.moveCursor, _.random(250, 750));
      console.info("OVERLAY! SKIPPING!");
      return;
    }

    await retry(
      async () => {
        if (KrogerAuth.page.isClosed()) { return; }
        await KrogerAuth.page.waitForSelector(
          '[data-testid="SiteMenuContent--CloseButton"]',
          {
            state: "hidden",
            timeout: 5000,
          }
        );
        if (KrogerAuth.page.isClosed()) { return; }
        await KrogerAuth.page.click('[data-testid="SiteMenu-HamburgerMenu--Button"]', {
          delay: _.random(1, 15),
          timeout: 5000,
        });
        if (KrogerAuth.page.isClosed()) { return; }
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
        if (KrogerAuth.page.isClosed()) { return; }
        await KrogerAuth.page.click('[data-testid="SiteMenuContent--CloseButton"]', {
          delay: _.random(1, 15),
          timeout: 5000,
        });
        if (KrogerAuth.page.isClosed()) { return; }
        await KrogerAuth.page.waitForSelector(
          '[data-testid="SiteMenuContent--CloseButton"]',
          {
            state: "hidden",
            timeout: 5000,
          }
        );
        if (KrogerAuth.page.isClosed()) { return; }
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

    KrogerAuth.moveCursorTimeout = setTimeout(KrogerAuth.moveCursor, _.random(250, 750));
  },
};

module.exports = KrogerAuth;
