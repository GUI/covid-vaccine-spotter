const got = require("got");
const _ = require("lodash");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

class ThriftyWhiteStores {
  static async findStores() {
    const resp = await got("https://www.thriftywhite.com/locations", {
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      timeout: 30000,
      retry: 0,
    });

    const locations = JSON.parse(
      resp.body.match(/<script.*?\blocations\s*=\s*(.+?);\s*<\/script>/i)[1]
    );
    for (const location of locations) {
      logger.info(`Importing store ${location.NAME} #${location.STORENUMBER}`);

      await Store.query()
        .insert({
          brand: "thrifty_white",
          brand_id: location.STORENUMBER,
          name: location.NAME,
          address: _.trim([location.ADDRESS1, location.ADDRESS2].join(" ")),
          city: location.CITY,
          state: location.STATE,
          postal_code: location.ZIP,
          location: `point(${location.YCOORD} ${location.XCOORD})`,
          metadata_raw: location,
        })
        .onConflict(["brand", "brand_id"])
        .merge();
    }

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.brand = 'thrifty_white'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().destroy();
  }
}

module.exports = ThriftyWhiteStores;
