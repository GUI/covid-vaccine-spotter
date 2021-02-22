require("dotenv").config();

const retry = require("async-retry");
const sleep = require("sleep-promise");
const { Cookie, CookieJar } = require("tough-cookie");
const { firefox } = require("playwright-extra");
const util = require("util");
const RecaptchaPlugin = require("@extra/recaptcha");
const logger = require("../logger");

const RecaptchaOptions = {
  visualFeedback: true,
  provider: {
    id: "2captcha",
    token: process.env.CAPTCHA_API_KEY,
  },
};
firefox.use(RecaptchaPlugin(RecaptchaOptions));

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

async function clickBotButton(page) {
  let visible = false;
  try {
    visible = await page.isVisible(".sc-block-modal iframe", { timeout: 1000 });
  } catch {
    logger.debug("No bot button detected.");
  }

  if (visible) {
    logger.info("Bot button detected, attempting to click...");
    const frame = await findInFrames(
      page,
      '[aria-label="Human Challenge requires verification. Please press and hold the button until verified"]:visible'
    );
    const button = await frame.$("text=Press & Hold");
    await button.click({
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
  }
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

    const browser = await firefox.launch({
      headless: true,
    });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
      });

      const page = await context.newPage();

      logger.info("Navigating to login page...");
      await page.goto(
        "https://www.samsclub.com/login?redirectURL=%2Fpharmacy%2Fimmunization%2Fform%3FimzType%3Dcovid"
      );

      await page.solveRecaptchas();

      await clickBotButton(page);
      logger.info("Filling in credentials...");
      await page.fill("input[name=email]", process.env.SAMS_CLUB_EMAIL);
      await page.fill(
        "input[name=current-password]",
        process.env.SAMS_CLUB_PASSWORD
      );
      await retry(
        async () => {
          await clickBotButton(page);
          await page.click("[type=submit]");
          await clickBotButton(page);
          await page.solveRecaptchas();
          await page.waitForSelector(
            'input[aria-label="ZIP Code or city and state"]',
            {
              timeout: 20000,
            }
          );
        },
        {
          retries: 5,
          minTimeout: 5,
          maxTimeout: 20,
        }
      );

      logger.info("Page title: ", await page.title());
      await clickBotButton(page);
      logger.info("Filling in zip code...");
      await page.fill(
        'input[aria-label="ZIP Code or city and state"]',
        "80620"
      );
      await retry(
        async () => {
          await clickBotButton(page);
          await page.click("button[type=submit]");
          await clickBotButton(page);
          await page.solveRecaptchas();
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
      logger.info("Selecting store...");
      await page.waitForSelector('input[value="8147"]');
      const radio = await page.$('input[value="8147"]');
      const parent = await radio.$("xpath=..");
      await parent.click();
      await sleep(500);
      await page.click("button.continue-btn");

      logger.info("Waiting on ajax response...");
      const ageResp = await page.waitForResponse(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
      );
      logger.info("Initial ageResp: ", ageResp.status());
      if (ageResp.status() === 412) {
        await page.waitForSelector(".sc-block-modal iframe");
        await clickBotButton(page);
        const ageResp2 = await page.waitForResponse(
          "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
        );
        logger.info("Second ageResp (after bot button): ", ageResp2.status());
      }

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
