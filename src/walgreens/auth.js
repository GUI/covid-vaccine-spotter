require('dotenv').config();

const util = require('util');
const _ = require('lodash');
const { Cookie, CookieJar } = require('tough-cookie');
const sleep = require('sleep-promise');
const { firefox } = require('playwright-extra');
const HumanizePlugin = require('@extra/humanize');
const logger = require('../logger');

firefox.use(
  HumanizePlugin({
    mouse: {
      showCursor: true, // Show the cursor (meant for testing)
    },
  })
);

const Auth = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    }
    return Auth.refresh();
  },

  refresh: async () => {
    logger.info('Refreshing Walgreens auth');

    const cookieJar = new CookieJar();

    const browser = await firefox.launch({
      headless: true,
      proxy: {
        server: process.env.PROXY_RANDOM_SERVER,
        username: process.env.PROXY_RANDOM_USERNAME,
        password: process.env.PROXY_RANDOM_PASSWORD,
      },
    });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0',
      });

      const page = await context.newPage();

      logger.info('Navigating to login page...');
      await page.goto(
        'https://www.walgreens.com/login.jsp?ru=%2Ffindcare%2Fvaccination%2Fcovid-19%2Feligibility-survey%3Fflow%3Dcovidvaccine%26register%3Drx',
        {
          waitUntil: 'networkidle',
        }
      );
      await sleep(1000);

      logger.info('Filling in credentials...');
      await sleep(_.random(300, 500));
      await page.click('input[name=username]');
      // await (await page.$('input[name=username]')).press('Backspace')
      await page.fill('input[name=username]', process.env.WALGREENS_EMAIL);
      await sleep(_.random(300, 500));
      await page.click('input[name=password]');
      // await (await page.$('input[name=password]')).press('Backspace')
      await page.fill('input[name=password]', process.env.WALGREENS_PASSWORD);
      await sleep(_.random(500, 750));

      let waitForLoginResponsePromise = page.waitForResponse((response) =>
        response.url().startsWith('https://www.walgreens.com/profile/v1/login')
      );
      let waitForLoginIdlePromise = page.waitForLoadState('networkidle');
      await (await page.$('input[name=password]')).press('Enter');
      // await page.click("#submit_btn");
      logger.info('Waiting on login response.');
      await waitForLoginResponsePromise;
      logger.info('Waiting on login idle state.');
      await waitForLoginIdlePromise;

      for (let i = 0; i < 5; i += 1) {
        let errorVisible;
        try {
          errorVisible = await page.isVisible('#error_msg', { timeout: 1000 });
        } catch {
          logger.debug('No error message detected.');
        }

        if (errorVisible) {
          logger.info('Retrying login due to login error message.');
          await sleep(_.random(1000, 2000));
          await page.click('input[name=username]');
          await sleep(_.random(300, 500));
          await page.click('input[name=password]');
          await sleep(_.random(300, 500));

          waitForLoginResponsePromise = page.waitForResponse(
            'https://www.walgreens.com/profile/v1/login'
          );
          waitForLoginIdlePromise = page.waitForLoadState('networkidle');
          await (await page.$('input[name=password]')).press('Enter');
          logger.info('Waiting on login response.');
          await waitForLoginResponsePromise;
          logger.info('Waiting on login idle state.');
          await waitForLoginIdlePromise;
        } else {
          break;
        }
      }

      logger.info('Waiting for post-login page.');
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('.ApptScreens, #radio-security');
      await sleep(1500);
      await page.waitForSelector('.ApptScreens, #radio-security');
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle');

      let visible;
      try {
        visible = await page.isVisible('#radio-security', { timeout: 2000 });
      } catch {
        logger.debug('No radio button detected.');
      }

      if (visible) {
        logger.info('Answering security question.');
        await page.check('#radio-security');
        await page.click('#optionContinue');
        await page.fill('#secQues', process.env.WALGREENS_SECURITY);
        await page.click('#validate_security_answer');

        // await sleep(15000);
      }

      logger.info('Waiting for successful login page.');
      await page.waitForSelector('.ApptScreens');

      // await sleep(100000);

      // await page.screenshot({ path: "screenshot.png" });
      logger.info('Getting cookies');
      for (const cookie of await context.cookies()) {
        const putCookie = util.promisify(
          cookieJar.store.putCookie.bind(cookieJar.store)
        );
        await putCookie(
          new Cookie({
            key: cookie.name,
            value: cookie.value,
            domain: cookie.domain.replace(/^\./, ''),
            path: cookie.path,
            expires:
              cookie.expires && cookie.expires !== -1
                ? new Date(cookie.expires * 1000)
                : 'Infinity',
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

    const auth = {
      cookieJar,
    };
    // console.info('AUTH: ', auth);
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};

module.exports = Auth;
