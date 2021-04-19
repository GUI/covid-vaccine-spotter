const util = require("util");
const { Cookie, CookieJar } = require("tough-cookie");
const { firefox } = require("playwright-extra");
const { PlaywrightBlocker } = require("@cliqz/adblocker-playwright");
const fetch = require("cross-fetch");
const logger = require("../../logger");
const { Cache } = require("../../models/Cache");

class Auth {
  static async get() {
    if (Auth.auth) {
      return Auth.auth;
    }

    const cache = await Cache.query().findById("publix_auth");
    if (cache) {
      const cookieJar = CookieJar.fromJSON(cache.value.cookieJar);
      const auth = {
        ...cache.value,
        cookieJar,
      };
      Auth.set(auth);
      return auth;
    }

    return Auth.refresh();
  }

  static async refresh() {
    logger.info("Refreshing Publix auth");

    const auth = {};

    const browser = await firefox.launch({
      headless: false,
      firefoxUserPrefs: {
        "general.appversion.override":
          "5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
        "general.oscpu.override": "Intel Mac OS X 10.15",
        "general.platform.override": "MacIntel",
        "general.useragent.override":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
        "intl.accept_languages": "en-US, en",
        "intl.locale.requested": "en-US",
      },
    });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
      });

      const page = await context.newPage();

      const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
      await blocker.enableBlockingInPage(page);

      blocker.on("request-blocked", (request) => {
        logger.debug("Blocked:", request.url);
      });

      logger.info("Navigating to landing page...");
      await page.goto("https://www.publix.com/covid-vaccine/florida", {
        waitUntil: "load",
      });

      logger.info("Navigating to appointment page...");
      const waitForAppointmentPromise = page.waitForNavigation({
        waitUntil: "load",
      });
      await page.click("a[href*='eid=']");
      await waitForAppointmentPromise;

      logger.info("Getting request verification token");
      auth.requestVerificationToken = await page.getAttribute(
        "input[name=__RequestVerificationToken]",
        "value"
      );

      logger.info("Getting cookies");
      auth.cookieJar = new CookieJar();
      for (const cookie of await context.cookies()) {
        const putCookie = util.promisify(
          auth.cookieJar.store.putCookie.bind(auth.cookieJar.store)
        );
        await putCookie(
          new Cookie({
            key: cookie.name,
            value: cookie.value,
            domain: cookie.domain.replace(/^\./, ""),
            path: cookie.path,
            expires:
              cookie.expires && cookie.expires !== -1
                ? new Date(cookie.expires * 1000)
                : "Infinity",
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          })
        );
      }
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    await Cache.query()
      .insert({
        id: "publix_auth",
        value: {
          ...auth,
          cookieJar: auth.cookieJar.toJSON(),
        },
      })
      .onConflict("id")
      .merge();

    Auth.set(auth);

    return auth;
  }

  static set(auth) {
    Auth.auth = auth;
  }
}

module.exports = Auth;
