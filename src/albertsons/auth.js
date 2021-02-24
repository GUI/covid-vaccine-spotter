const got = require("got");
const _ = require("lodash");
const sleep = require("sleep-promise");
const { CookieJar } = require("tough-cookie");

const Auth = {
  auth: {},

  get: async (authParam) => {
    if (Auth.auth[authParam]) {
      return Auth.auth[authParam];
    }
    return Auth.refresh(authParam);
  },

  refresh: async (authParam) => {
    const cookieJar = new CookieJar();
    const resp = await got(
      "https://kordinator.mhealthcoach.net/loginPharmacistFromEmail.do",
      {
        searchParams: {
          _r: _.random(0, 999999999999),
          p: authParam,
          timeZone: "America/Denver",
          type: "registration",
        },
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        },
        cookieJar,
        responseType: "json",
      }
    );

    await sleep(1000);

    const auth = {
      cookieJar,
      body: resp.body,
    };
    Auth.set(authParam, auth);

    return auth;
  },

  set: (authParam, auth) => {
    Auth.auth[authParam] = auth;
  },
};

module.exports = Auth;
