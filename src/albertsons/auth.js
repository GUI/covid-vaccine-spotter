const got = require("got");
const _ = require("lodash");
const sleep = require("sleep-promise");
const { CookieJar } = require("tough-cookie");

const Auth = {
  get: async () => {
    if (Auth.auth) {
      return Auth.auth;
    }
    return Auth.refresh();
  },

  refresh: async () => {
    const cookieJar = new CookieJar();
    const resp = await got(
      "https://kordinator.mhealthcoach.net/loginPharmacistFromEmail.do",
      {
        searchParams: {
          _r: _.random(0, 999999999999),
          p:
            "II0ynmRV1omFIP5gOUX-j4DtpYTOLn1oi4DJk2CiwauEuGNMFIHHGG64vTISvcZCDFC4btPH2cJRcuMwWdiLPavNg6ba7W57BTVRCQfgBPh2xbZ6cCUGSCdP83IaCE6ACXzT_sdBhi7RgZ7i9sHcj2VV1r9ycAM8oMRqLBHEjOOSgjzMi4SYiCiNLaWVuqgYPOr0NnQAkjTjxlEnnq8yheEeN-3e4ZRTcL8Puven8BAP-h1Wha5VEII1fYG6P-qp",
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
    Auth.set(auth);

    return auth;
  },

  set: (auth) => {
    Auth.auth = auth;
  },
};

module.exports = Auth;
