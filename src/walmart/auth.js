const got = require('got');
const _ = require('lodash');
const sleep = require('sleep-promise');
const { CookieJar } = require('tough-cookie');

const Auth = module.exports = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    } else {
      return await Auth.refresh();
    }
  },

  refresh: async () => {
    const cookieJar = new CookieJar();
    const resp = await got.post('https://www.walmart.com/account/electrode/api/signin?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid', {
      headers: {
        // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        'authority': 'www.walmart.com',
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        'accept': '*/*',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
        'content-type': 'application/json',
        'origin': 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://www.walmart.com/account/login?returnUrl=/pharmacy/clinical-services/immunization/scheduled?imzType=covid',
        'accept-language': 'en-US,en;q=0.9',
      },
      cookieJar,
      // responseType: 'json',
      json: {
        username: process.env.WALMART_USERNAME,
        password: process.env.WALMART_PASSWORD,
        rememberme: true,
        showRememberme: 'true',
        captcha: {
          sensorData: '',
        },
      },
      retry: 0,
    });

    await sleep(1000);

    const auth = {
      cookieJar,
      body: JSON.parse(resp.body),
    };
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};
