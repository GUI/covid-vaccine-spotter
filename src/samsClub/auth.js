const got = require("got");
const retry = require("async-retry");
const _ = require("lodash");
const sleep = require("sleep-promise");
const { Cookie, CookieJar } = require("tough-cookie");
const { HttpsProxyAgent } = require("hpagent");
const playwright = require("playwright-aws-lambda");
const { firefox } = require("playwright-extra");
const util = require("util");

/*
const HumanizePlugin = require('@extra/humanize')
firefox.use(
  HumanizePlugin({
    mouse: {
      showCursor: true // Show the cursor (meant for testing)
    }
  })
)
*/

async function recursiveFindInFrames(inputFrame, selector) {
  const frames = inputFrame.childFrames();
  const results = await Promise.all(
    frames.map(async (frame) => {
      // console.info('frame.isVisible(): ', await frame.isVisible('body'));
      const el = await frame.$(selector);
      // console.info('frame.el: ', await frame.isVisible('body'), el);
      if (el) return el;
      if (frame.childFrames().length > 0) {
        return await recursiveFindInFrames(frame, selector);
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

const Auth = (module.exports = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    } else {
      return await Auth.refresh();
    }
  },

  refresh: async () => {
    console.info("Refreshing Sam's Club auth");

    const cookieJar = new CookieJar();

    /*
    const browser = await firefox.launch({
      headless: false,
      devtools: true,
    });
    */

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

      console.log("Page title: ", await page.title());
      //console.info('cookies: ', await context.cookies());
      // await page.goto('https://www.samsclub.com/pharmacy/immunization/form?imzType=covid');
      //await page.waitForLoadState('networkidle');
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
      // await page.click('button:text("Continue")');

      const ageResp = await page.waitForResponse(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility"
      );
      console.info("ageResp: ", ageResp.status());
      if (ageResp.status() === 412) {
        // sc-modal sc-modal-background sc-block-modal
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
        console.info("ageResp2: ", ageResp2.status());
      }

      // await page.click('label[for="3ea8a857-c3bb-405c-9715-96056d04ad57"]');
      // console.info('cookies: ', await context.cookies());
      for (const cookie of await context.cookies()) {
        // console.info('cookie:', cookie);
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
              cookie.expires && cookie.expires != -1
                ? new Date(cookie.expires * 1000)
                : "Infinity",
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          })
        );
      }
      /*
      await putCookie(new Cookie({
        key: 's_sq',
        value: '%5B%5BB%5D%5D',
        domain: 'samsclub.com',
        path: '/',
      }));
      await putCookie(new Cookie({
        key: '_pxff_fp',
        value: '1',
        domain: 'samsclub.com',
        path: '/',
      }));
      await putCookie(new Cookie({
        key: '_pxff_rf',
        value: '1',
        domain: 'samsclub.com',
        path: '/',
      }));
      */

      // console.info(cookieJar);
      // console.info('cookieJar: ', cookieJar.toJSON());
    } catch (error) {
      throw error;
    } finally {
      /*
      if (browser) {
        await browser.close();
      }
      */
    }

    // const cookieJar = new CookieJar();
    //const findCookie = util.promisify(cookieJar.store.findCookie);

    //     const loginResp = await got('https://www.samsclub.com/login', {
    //       headers: {
    //         // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
    //         'authority': 'www.samsclub.com',
    //         'pragma': 'no-cache',
    //         'cache-control': 'no-cache',
    //         'sec-ch-ua': '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
    //         'sec-ch-ua-mobile': '?0',
    //         'upgrade-insecure-requests': '1',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    //         'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    //         'sec-fetch-site': 'none',
    //         'sec-fetch-mode': 'navigate',
    //         'sec-fetch-user': '?1',
    //         'sec-fetch-dest': 'document',
    //         'accept-language': 'en-US,en;q=0.9',
    //       },
    //       decompress: true,
    //       cookieJar,
    //       http2: true,
    //       retry: 0,
    //     });
    //     console.info('loginResp: ', loginResp.body);
    //     console.info('loginResp: ', loginResp.headers);
    //
    //     const pingResp = await got('https://www.samsclub.com/api/node/sams/common/wping.jsp', {
    //       headers: {
    //         'authority': 'www.samsclub.com',
    //         'pragma': 'no-cache',
    //         'cache-control': 'no-cache',
    //         'sec-ch-ua': '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
    //         'accept': 'application/json, text/plain, */*',
    //         'sec-ch-ua-mobile': '?0',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    //         'sec-fetch-site': 'same-origin',
    //         'sec-fetch-mode': 'cors',
    //         'sec-fetch-dest': 'empty',
    //         'referer': 'https://www.samsclub.com/login',
    //         'accept-language': 'en-US,en;q=0.9',
    //       },
    //       decompress: true,
    //       cookieJar,
    //       http2: true,
    //       retry: 0,
    //     });
    //     console.info('pingResp: ', pingResp.body);
    //     console.info('pingResp: ', pingResp.headers);
    //
    //     console.info('cookieJar: ', cookieJar);
    //     console.info('cookieJar: ', cookieJar.findCookie);
    //     console.info('cookieJar: ', cookieJar.store);
    //     console.info('cookieJar: ', cookieJar.store.findCookie);
    //     //console.info('cookieJar: ', await cookieJar.store.findCookie('titan.samsclub.com', '/', 'samsHubbleSession'));
    //     console.info('cookieJar: ', cookieJar.toJSON());
    //
    //     //const tmxId = await cookieJar.store.findCookie('titan.samsclub.com', '/', 'samsHubbleSession');
    //     const authorizeResp = await got('https://titan.samsclub.com/prodtitan.onmicrosoft.com/oauth2/v2.0/authorize', {
    //       searchParams: {
    //         p: 'B2C_1A_SignInWebWithKmsi',
    //         client_id: 'cdc1bba2-f1a2-472d-8e4e-f06b21f3d81a',
    //         nonce: 'defaultNonce',
    //         scope: 'openid offline_access https://prodtitan.onmicrosoft.com/sams-web-api/dotcom https://prodtitan.onmicrosoft.com/sams-web-api/user_impersonation',
    //         response_type: 'id_token token',
    //         tmxId: pingResp.body,
    //         visitorid: pingResp.body,
    //         sli: 'true',
    //         fromCint: 'true',
    //         redirectURL: '/cart?action=initcheckout',
    //         xid: 'cart:begin-checkout',
    //         redirect_uri: 'https://www.samsclub.com/js/b2c-v14/handle-redirect.html',
    //         client_redirect_uri: 'https://www.samsclub.com/js/b2c-v14/handle-redirect.html',
    //       },
    //       headers: {
    //         'authority': 'titan.samsclub.com',
    //         'pragma': 'no-cache',
    //         'cache-control': 'no-cache',
    //         'sec-ch-ua': '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
    //         'sec-ch-ua-mobile': '?0',
    //         'upgrade-insecure-requests': '1',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    //         'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    //         'sec-fetch-site': 'same-site',
    //         'sec-fetch-mode': 'navigate',
    //         'sec-fetch-dest': 'iframe',
    //         'referer': 'https://www.samsclub.com/',
    //         'accept-language': 'en-US,en;q=0.9',
    //       },
    //       decompress: true,
    //       cookieJar,
    //       http2: true,
    //       retry: 0,
    //     });
    //     console.info('authorizeResp: ', authorizeResp.body);
    //     console.info('authorizeResp.request: ', authorizeResp.request);
    //     console.info('authorizeResp.url: ', authorizeResp.url);
    //     const transId = authorizeResp.body.match(/transId['"]?:\s*['"]([^'"]+)/)[1]
    //     const csrf = authorizeResp.body.match(/csrf['"]?:\s*['"]([^'"]+)/)[1]
    //     console.info('csrf: ', csrf);
    //     console.info('transId: ', transId);
    //
    //     const perfResp = await got.post('https://titan.samsclub.com/prodtitan.onmicrosoft.com/B2C_1A_SignInWebWithKmsi/client/perftrace', {
    //       searchParams: {
    //         tx: transId,
    //         p: 'B2C_1A_SignInWebWithKmsi',
    //       },
    //       headers: {
    //         'authority': 'titan.samsclub.com',
    //         'pragma': 'no-cache',
    //         'cache-control': 'no-cache',
    //         'sec-ch-ua': '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
    //         'accept': 'application/json, text/javascript, */*; q=0.01',
    //         'x-csrf-token': csrf,
    //         'x-requested-with': 'XMLHttpRequest',
    //         'sec-ch-ua-mobile': '?0',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    //         'content-type': 'application/json; charset=UTF-8',
    //         'origin': 'https://titan.samsclub.com',
    //         'sec-fetch-site': 'same-origin',
    //         'sec-fetch-mode': 'cors',
    //         'sec-fetch-dest': 'empty',
    //         'referer': authorizeResp.url,
    //         'accept-language': 'en-US,en;q=0.9',
    //       },
    //       json: {
    //         "navigation": {
    //           "type": 0,
    //           "redirectCount": 0
    //         },
    //         "timing": {
    //           "connectStart": 1613876972337,
    //           "navigationStart": 1613876972334,
    //           "loadEventEnd": 1613876972583,
    //           "domLoading": 1613876972509,
    //           "secureConnectionStart": 0,
    //           "fetchStart": 1613876972337,
    //           "domContentLoadedEventStart": 1613876972582,
    //           "responseStart": 1613876972503,
    //           "responseEnd": 1613876972551,
    //           "domInteractive": 1613876972582,
    //           "domainLookupEnd": 1613876972337,
    //           "redirectStart": 0,
    //           "requestStart": 1613876972348,
    //           "unloadEventEnd": 0,
    //           "unloadEventStart": 0,
    //           "domComplete": 1613876972583,
    //           "domainLookupStart": 1613876972337,
    //           "loadEventStart": 1613876972583,
    //           "domContentLoadedEventEnd": 1613876972583,
    //           "redirectEnd": 0,
    //           "connectEnd": 1613876972337
    //         },
    //         "entries": [
    //           {
    //             "name": "https://titan.samsclub.com/prodtitan.onmicrosoft.com/oauth2/v2.0/authorize?p=B2C_1A_SignInWebWithKmsi&client_id=cdc1bba2-f1a2-472d-8e4e-f06b21f3d81a&nonce=defaultNonce&scope=openid%20offline_access%20https%3A%2F%2Fprodtitan.onmicrosoft.com%2Fsams-web-api%2Fdotcom%20https%3A%2F%2Fprodtitan.onmicrosoft.com%2Fsams-web-api%2Fuser_impersonation&response_type=id_token%20token&tmxId=CFCFD54FE0991615DECF1759765FBE08.estoreapp-274179263-2-548829331&visitorid=CFCFD54FE0991615DECF1759765FBE08.estoreapp-274179263-2-548829331&sli=true&redirectURL=%2F%3FsignOutSuccessUrl%3D%252F%253Fxid%253Dhdr_account_logout&redirect_uri=https%3A%2F%2Fwww.samsclub.com%2Fjs%2Fb2c-v14%2Fhandle-redirect.html&client_redirect_uri=https%3A%2F%2Fwww.samsclub.com%2Fjs%2Fb2c-v14%2Fhandle-redirect.html",
    //             "entryType": "navigation",
    //             "startTime": 0,
    //             "duration": 248.98500001290813,
    //             "initiatorType": "navigation",
    //             "nextHopProtocol": "h2",
    //             "workerStart": 0,
    //             "redirectStart": 0,
    //             "redirectEnd": 0,
    //             "fetchStart": 3.3500000135973096,
    //             "domainLookupStart": 3.3500000135973096,
    //             "domainLookupEnd": 3.3500000135973096,
    //             "connectStart": 3.3500000135973096,
    //             "connectEnd": 3.3500000135973096,
    //             "secureConnectionStart": 3.3500000135973096,
    //             "requestStart": 14.300000009825453,
    //             "responseStart": 168.55000000214204,
    //             "responseEnd": 217.46000001439825,
    //             "transferSize": 70893,
    //             "encodedBodySize": 68067,
    //             "decodedBodySize": 227037,
    //             "serverTiming": [],
    //             "workerTiming": [],
    //             "unloadEventStart": 0,
    //             "unloadEventEnd": 0,
    //             "domInteractive": 248.28500000876375,
    //             "domContentLoadedEventStart": 248.35999999777414,
    //             "domContentLoadedEventEnd": 248.6800000187941,
    //             "domComplete": 248.95999999716878,
    //             "loadEventStart": 248.98500001290813,
    //             "loadEventEnd": 248.98500001290813,
    //             "type": "navigate",
    //             "redirectCount": 0
    //           },
    //           {
    //             "name": "https://www.samsclub.com/js/b2c-v14/login.html",
    //             "entryType": "resource",
    //             "startTime": 242.93000000761822,
    //             "duration": 9.690000006230548,
    //             "initiatorType": "xmlhttprequest",
    //             "nextHopProtocol": "h2",
    //             "workerStart": 0,
    //             "redirectStart": 0,
    //             "redirectEnd": 0,
    //             "fetchStart": 242.93000000761822,
    //             "domainLookupStart": 0,
    //             "domainLookupEnd": 0,
    //             "connectStart": 0,
    //             "connectEnd": 0,
    //             "secureConnectionStart": 0,
    //             "requestStart": 0,
    //             "responseStart": 0,
    //             "responseEnd": 252.62000001384877,
    //             "transferSize": 0,
    //             "encodedBodySize": 0,
    //             "decodedBodySize": 0,
    //             "serverTiming": [],
    //             "workerTiming": []
    //           }
    //         ],
    //         "connection": {
    //           "onchange": null,
    //           "effectiveType": "4g",
    //           "rtt": 50,
    //           "downlink": 10,
    //           "saveData": false
    //         }
    //       },
    //       decompress: true,
    //       cookieJar,
    //       http2: true,
    //       retry: 0,
    //     });
    //     console.info('perfResp: ', perfResp);
    //
    //     try {
    //     const resp = await got.post('https://titan.samsclub.com/prodtitan.onmicrosoft.com/B2C_1A_SignInWebWithKmsi/SelfAsserted', {
    //       searchParams: {
    //         tx: transId,
    //         p: 'B2C_1A_SignInWebWithKmsi',
    //       },
    //       headers: {
    //         'authority': 'titan.samsclub.com',
    //         'pragma': 'no-cache',
    //         'cache-control': 'no-cache',
    //         'sec-ch-ua': '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
    //         'accept': 'application/json, text/javascript, */*; q=0.01',
    //         'x-csrf-token': csrf,
    //         'x-requested-with': 'XMLHttpRequest',
    //         'sec-ch-ua-mobile': '?0',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    //         'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    //         'origin': 'https://titan.samsclub.com',
    //         'sec-fetch-site': 'same-origin',
    //         'sec-fetch-mode': 'cors',
    //         'sec-fetch-dest': 'empty',
    //         'referer': authorizeResp.url,
    //         'accept-language': 'en-US,en;q=0.9',
    //       },
    //       form: {
    //         request_type: 'RESPONSE',
    //         signInName: process.env.SAMS_CLUB_EMAIL,
    //         password: process.env.SAMS_CLUB_PASSWORD,
    //       },
    //       decompress: true,
    //       cookieJar,
    //       http2: true,
    //       retry: 0,
    //     });
    //     console.info(resp.body);
    //     } catch(err) {
    //       console.info(err);
    //       console.info(err.response);
    //       console.info(err.response.url);
    //     }
    //     process.exit(1)

    await sleep(1000);

    const auth = {
      cookieJar,
      //body: JSON.parse(resp.body),
    };
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
});
