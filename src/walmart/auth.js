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
        'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      },
      cookieJar,
      responseType: 'json',
      json: {
        username: process.env.WALMART_USERNAME,
        password: process.env.WALMART_PASSWORD,
      },
    });

    await sleep(1000);

    const auth = {
      cookieJar,
      body: resp.body,
    };
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};
