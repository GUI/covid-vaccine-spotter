const retry = require("async-retry");
const sleep = require("sleep-promise");
const { Cookie, CookieJar } = require("tough-cookie");
const playwright = require("playwright-aws-lambda");
const util = require("util");
const logger = require("../logger");

async function recursiveFindInFrames(inputFrame, selector) {
  const frames = inputFrame.childFrames();
  const results = await Promise.all(
    frames.map(async (frame) => {
      const el = await frame.$(selector);
      if (el) return el;
      if (frame.childFrames().length > 0) {
        return recursiveFindInFrames(frame, selector);
      }
      return null;
    })
  );
  return results.find(Boolean);
}

async function findInFrames(page, selector) {
  const result = await recursiveFindInFrames(page.mainFrame(), selector);
  if (!result) {
    throw new Error(
      `The selector \`${selector}\` could not be found in any child frames.`
    );
  }
  return result;
}

const Auth = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    }
    return Auth.refresh();
  },

  refresh: async () => {
    logger.info("Refreshing Sam's Club auth");

    const cookieJar = new CookieJar();

    const browser = await playwright.launchChromium({
      headless: false,
      // devtools: true,
    });
    try {
      const context = await browser.newContext();

      const page = await context.newPage();
      await page.goto(
        "https://www.samsclub.com/login?redirectURL=%2Fpharmacy%2Fimmunization%2Fform%3FimzType%3Dcovid"
      );

      await page.fill("input[name=email]", process.env.SAMS_CLUB_EMAIL);
      await page.fill(
        "input[name=current-password]",
        process.env.SAMS_CLUB_PASSWORD
      );
      await retry(
        async () => {
          await page.click("[type=submit]");
          await page.waitForSelector(
            'input[aria-label="ZIP Code or city and state"]',
            {
              timeout: 5000,
            }
          );
        },
        {
          retries: 5,
          minTimeout: 5,
          maxTimeout: 20,
        }
      );
      await page.waitForLoadState("load");

      logger.info("Page title: ", await page.title());
      await page.fill(
        'input[aria-label="ZIP Code or city and state"]',
        "80620"
      );
      await retry(
        async () => {
          await page.click("button[type=submit]");
          await page.waitForSelector(
            ".sc-pharmacy-club-selection-club-radio-group input[type=radio]",
            {
              timeout: 5000,
            }
          );
        },
        {
          retries: 5,
          minTimeout: 5,
          maxTimeout: 20,
        }
      );
      await page.waitForSelector('input[value="8147"]');
      const radio = await page.$('input[value="8147"]');
      const parent = await radio.$("xpath=..");
      await parent.click();
      // await page.waitForLoadState('networkidle');
      await sleep(500);
      await page.click("button.continue-btn");

      const ageResp = await page.waitForResponse(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
      );
      logger.info("ageResp: ", ageResp.status());
      if (ageResp.status() === 412) {
        await page.waitForSelector(".sc-block-modal iframe");
        const foo = await findInFrames(
          page,
          '[aria-label="Human Challenge requires verification. Please press and hold the button until verified"]:visible'
        );
        const bar = await foo.$("text=Press & Hold");
        await bar.click({
          delay: 12000,
          force: true,
          position: {
            x: 50,
            y: 20,
          },
        });
        await page.waitForSelector(".sc-block-modal", {
          state: "hidden",
        });
        const ageResp2 = await page.waitForResponse(
          "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
        );
        logger.info("ageResp2: ", ageResp2.status());
      }

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

    await sleep(1000);

    const auth = {
      cookieJar,
    };
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};

module.exports = Auth;
