const got = require("got");
const util = require("util");
const _ = require("lodash");
const { Cookie, CookieJar } = require("tough-cookie");
const RecaptchaPlugin = require("@extra/recaptcha");
const sleep = require("sleep-promise");
const { firefox } = require("playwright-extra");
const { HttpsProxyAgent } = require("hpagent");
const logger = require("../logger");

const RecaptchaOptions = {
  visualFeedback: true,
  provider: {
    id: "2captcha",
    token: process.env.CAPTCHA_API_KEY,
  },
};
firefox.use(RecaptchaPlugin(RecaptchaOptions));

const Auth = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    }
    return Auth.refresh();
  },

  refresh: async () => {
    logger.info("Refreshing Walmart auth");

    const cookieJar = new CookieJar();
    let body;

    const browser = await firefox.launch({
      headless: true,
      proxy: {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      },
    });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
      });

      const page = await context.newPage();

      logger.info("Navigating to login page...");
      await page.goto(
        "https://www.walmart.com/account/login?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
        {
          waitUntil: "domcontentloaded",
        }
      );

      await page.solveRecaptchas();

      logger.info("Filling in credentials...");
      await page.fill("input[name=email]", process.env.WALMART_USERNAME);
      await sleep(_.random(50, 150));
      await page.fill("input[name=password]", process.env.WALMART_PASSWORD);
      await sleep(_.random(50, 150));

      const responsePromise = page.waitForResponse((response) => response.url().startsWith("https://www.walmart.com/account/electrode/api/signin"));

      await page.click("[type=submit]");
      await page.solveRecaptchas();

      const response = await responsePromise;
      logger.info(`Signin ajax response: ${response.url()}: ${response.status()}`);
      body = await response.json();

      logger.info("Getting cookies");
      for (const cookie of await context.cookies()) {
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
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    /*
      const agent = {
        https: new HttpsProxyAgent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          maxSockets: 256,
          maxFreeSockets: 256,
          scheduling: "lifo",
          proxy: process.env.PROXY_URL,
        }),
      };
      const headers = {
        // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        authority: "www.walmart.com",
        pragma: "no-cache",
        "cache-control": "no-cache",
        */
    // accept: "*/*",
    // "user-agent":
    //  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
    /*
        origin: "https://www.walmart.com",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "accept-language": "en-US,en;q=0.9",
      };
      const cookieJar = new CookieJar();
      const resp = await got.post(
        "https://www.walmart.com/account/electrode/api/signin?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
        {
          headers: {
            ...headers,
            "content-type": "application/json",
            referer:
              "https://www.walmart.com/account/login?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
          },
          decompress: true,
          cookieJar,
          // responseType: 'json',
          http2: true,
          json: {
            username: process.env.WALMART_USERNAME,
            password: process.env.WALMART_PASSWORD,
            rememberme: true,
            showRememberme: "true",
            captcha: {
              sensorData: "",
            },
          },
          retry: 0,
          agent,
        }
      );
      */

    const auth = {
      cookieJar,
      body,
    };
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};

module.exports = Auth;
