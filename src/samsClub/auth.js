const retry = require("async-retry");
const sleep = require("sleep-promise");
const { Cookie, CookieJar } = require("tough-cookie");
// const chromium = require('chrome-aws-lambda');
// const { addExtra } = require('puppeteer-extra')
const util = require("util");
const logger = require("../logger");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')

puppeteer.use(StealthPlugin())
// puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

/*
const puppeteerExtra = addExtra(chromium.puppeteer)
puppeteerExtra.use(StealthPlugin())
puppeteerExtra.use(AdblockerPlugin())
*/

async function recursiveFindInFrames(inputFrame, selector) {
  const frames = inputFrame.childFrames();
  const results = await Promise.all(
    frames.map(async (frame) => {
      const el = await frame.$(selector);
      if (el) {
        const visible = await frame.evaluate((e) => {
          var style = window.getComputedStyle(e);
          if (style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return true;
          } else {
            return false;
          }
        }, el);
        if (visible) {
          return el;
        }
      }
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

async function isVisible(page, selector) {
  return await page.evaluate((selector) => {
    var e = document.querySelector(selector);
    if (e) {
      var style = window.getComputedStyle(e);

      return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
    else {
      return false;
    }
  }, selector);
}

async function clickBotButton(page) {
  if (await isVisible(page, ".sc-block-modal iframe")) {
    const frame = await findInFrames(
      page,
      '[aria-label="Human Challenge requires verification. Please press and hold the button until verified"]'
    );
    const button = (await frame.$x("//*[contains(., 'Press & Hold')]"))[0];
    await button.click({
      delay: 12000,
      force: true,
      position: {
        x: 50,
        y: 20,
      },
    });
    await page.waitForSelector(".sc-block-modal", {
      hidden: true,
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

    let browser;

    try {
      browser = await puppeteer.launch({
        // args: chromium.args,
        // defaultViewport: chromium.defaultViewport,
        // executablePath: await chromium.executablePath,
        // headless: chromium.headless,
        headless: false,
        devtools: true,
        // ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      await page.goto(
        "https://www.samsclub.com/login?redirectURL=%2Fpharmacy%2Fimmunization%2Fform%3FimzType%3Dcovid",
        { waitUntil: 'networkidle0' },
      );

      await clickBotButton(page);
      await page.waitForSelector("input[name=email]", { visible: true });
      await page.waitForSelector("input[name=current-password]", { visible: true });
      await page.waitForSelector("[type=submit]", { visible: true });
      await page.focus("input[name=email]");
      await page.keyboard.type(process.env.SAMS_CLUB_EMAIL);
      await page.focus("input[name=current-password]");
      await page.keyboard.type(process.env.SAMS_CLUB_PASSWORD);
      await sleep(500);
      await retry(
        async () => {
          await clickBotButton(page);
          await page.click("[type=submit]");
          await page.waitForSelector(
            'input[aria-label="ZIP Code or city and state"]',
            {
              visible: true,
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

      logger.info("Page title: ", await page.title());
      await page.waitForSelector('input[aria-label="ZIP Code or city and state"]', { visible: true });
      await page.focus('input[aria-label="ZIP Code or city and state"]');
      await page.keyboard.type("80620");
      await retry(
        async () => {
          await clickBotButton(page);
          await page.click("button[type=submit]");
          await page.waitForSelector(
            ".sc-pharmacy-club-selection-club-radio-group input[type=radio]",
            {
              visible: true,
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
      await page.waitForSelector('input[value="8147"]', { visible: true });
      const radio = await page.$('input[value="8147"]');
      const parent = (await radio.$x(".."))[0];
      console.info('parent: ', parent);
      await parent.click();
      // await page.waitForNavigation({ waitUntil: 'load' }),
      await sleep(500);
      await page.click("button.continue-btn");

      const ageResp = await page.waitForResponse(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
      );
      logger.info("ageResp: ", ageResp.status());
      if (ageResp.status() === 412) {
        await page.waitForSelector(".sc-block-modal iframe", { visible: true });
        await sleep(500);
        await clickBotButton(page);
        await sleep(2000);
        await page.click("button.continue-btn");
        const ageResp2 = await page.waitForResponse(
          "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
        );
        logger.info("ageResp2: ", ageResp2.status());
      }

      for (const cookie of await page.cookies()) {
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
