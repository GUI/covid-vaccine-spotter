const got = require("got");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const logger = require("../../logger");

class Auth {
  static async get() {
    if (Auth.auth) {
      return Auth.auth;
    }
    return Auth.refresh();
  }

  static async refresh() {
    logger.info("Refreshing Centura auth");

    const cookieJar = new CookieJar();
    const resp = await got("https://www.primarybio.com/r/truecare24-cdphe", {
      headers: {
        "User-Agent": "VaccineSpotter.org",
      },
      cookieJar,
    });

    const $body = cheerio.load(resp.body);
    const csrfToken = $body("meta[name=csrf-token]");

    const auth = {
      cookieJar,
      csrfToken: csrfToken.attr("content"),
    };
    Auth.set(auth);

    return auth;
  }

  static set(auth) {
    Auth.auth = auth;
  }
}

module.exports = Auth;
