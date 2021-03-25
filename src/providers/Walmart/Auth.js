require("dotenv").config();

const util = require("util");
const _ = require("lodash");
const { Cookie, CookieJar } = require("tough-cookie");
const retry = require("p-retry");
const RecaptchaPlugin = require("@extra/recaptcha");
const sleep = require("sleep-promise");
const { firefox } = require("playwright-extra");
const logger = require("../../logger");
const { Cache } = require("../../models/Cache");

const RecaptchaOptions = {
  visualFeedback: true,
  provider: {
    id: "2captcha",
    token: process.env.CAPTCHA_API_KEY,
  },
};
firefox.use(RecaptchaPlugin(RecaptchaOptions));

class Auth {
  static async get() {
    if (Auth.auth) {
      return Auth.auth;
    }

    const cache = await Cache.query().findById("walmart_auth");
    if (cache) {
      const cookieJar = CookieJar.fromJSON(cache.value.cookieJar);
      const auth = {
        cookieJar,
        body: cache.value.body,
      };
      Auth.set(auth);
      return auth;
    }

    return Auth.refresh();
  }

  static async ensureBrowserClosed() {
    if (Auth.page) {
      await Auth.page.close();
      Auth.page = undefined;
    }
    if (Auth.context) {
      await Auth.context.close();
      Auth.context = undefined;
    }
    if (Auth.browser) {
      await Auth.browser.close();
      Auth.browser = undefined;
    }
  }

  static async refresh() {
    let attempt = 0;
    const auth = await retry(
      async () => {
        attempt += 1;
        logger.info(`Refreshing Walmart auth (attempt ${attempt})`);

        const cookieJar = new CookieJar();
        let body;

        await Auth.ensureBrowserClosed();
        Auth.browser = await firefox.launch({
          headless: true,
          proxy: {
            server: process.env.WALMART_AUTH_PROXY_SERVER,
            username: process.env.WALMART_AUTH_PROXY_USERNAME,
            password: process.env.WALMART_AUTH_PROXY_PASSWORD,
          },
        });

        Auth.context = await Auth.browser.newContext({
          ignoreHTTPSErrors: true,
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
        });

        Auth.page = await Auth.context.newPage();

        // Manually perform some ad/tracking blocking to reduce proxied
        // bandwidth. But don't block as much as the "adblocker-playwright"
        // plugin would, since that seems to cause recaptcha issues on this
        // site now.
        Auth.page.route(
          /^https:\/\/[^/]*(bing.com|px-cloud.net|facebook|myvisualiq.net|yahoo.com|exelator.com|pinterest.com|yimg.com)/,
          (route) => {
            logger.debug("Blocking: ", route.request().url());
            route.abort();
          }
        );

        logger.info("Navigating to login page...");
        await Auth.page.goto(
          "https://www.walmart.com/account/login?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
          {
            waitUntil: "networkidle",
          }
        );

        logger.info("Filling in credentials...");
        await Auth.page.fill("input[name=email]", process.env.WALMART_USERNAME);
        await sleep(_.random(50, 150));
        await Auth.page.fill(
          "input[name=password]",
          process.env.WALMART_PASSWORD
        );
        await sleep(_.random(50, 150));

        const responsePromise = Auth.page.waitForResponse((resp) =>
          resp
            .url()
            .startsWith("https://www.walmart.com/account/electrode/api/signin")
        );

        await Auth.page.click("[type=submit]");

        logger.info("Waiting on signin ajax response...");
        const response = await responsePromise;
        logger.info(
          `Signin ajax response: ${response.url()}: ${response.status()}`
        );
        body = await response.json();
        if (!body?.payload?.cid) {
          logger.warn(
            `Login body does not contain expected data, trying to solve captcha: ${response.status()}: ${JSON.stringify(
              body
            )}`
          );

          await Auth.page.waitForLoadState("networkidle");

          const responsePromiseRetry = Auth.page.waitForResponse(
            (resp) =>
              resp
                .url()
                .startsWith(
                  "https://www.walmart.com/account/electrode/api/signin"
                ),
            { timeout: 180000 }
          );

          await Auth.page.solveRecaptchas();
          logger.info("Finished recaptcha");

          logger.info("Waiting on signin ajax response retry...");
          const responseRetry = await responsePromiseRetry;
          logger.info(
            `Signin ajax retry response: ${responseRetry.url()}: ${responseRetry.status()}`
          );
          body = await responseRetry.json();
          if (!body?.payload?.cid) {
            throw new Error(
              `Login body does not contain expected data: ${responseRetry.status()}: ${JSON.stringify(
                body
              )}`
            );
          }
        }

        logger.info("Getting cookies");
        for (const cookie of await Auth.context.cookies()) {
          const putCookie = util.promisify(
            cookieJar.store.putCookie.bind(cookieJar.store)
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

        return {
          cookieJar,
          body,
        };
      },
      {
        retries: 100,
        onFailedAttempt: (err) => {
          logger.error(err);
        },
      }
    );

    await Auth.ensureBrowserClosed();

    await Cache.query()
      .insert({
        id: "walmart_auth",
        value: {
          cookieJar: auth.cookieJar.toJSON(),
          body: auth.body,
        },
      })
      .onConflict("id")
      .merge();

    logger.info("Setting auth...");
    Auth.set(auth);
    logger.info("Finished auth refresh.");

    return auth;
  }

  static set(auth) {
    Auth.auth = auth;
  }
}

module.exports = Auth;
