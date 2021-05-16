const got = require("got");
const _ = require("lodash");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const setComputedStoreValues = require("../../setComputedStoreValues");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "thrifty_white",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "thrifty_white",
        key: "thrifty_white",
        name: "Thrifty White",
        url: "https://www.thriftywhite.com/covid19vaccine",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const resp = await got("https://www.thriftywhite.com/locations", {
      headers: {
        "User-Agent": "VaccineSpotter.org",
      },
      timeout: 30000,
      retry: 0,
    });

    const locations = JSON.parse(
      resp.body.match(/<script.*?\blocations\s*=\s*(.+?);\s*<\/script>/i)[1]
    );
    for (const location of locations) {
      logger.info(`Importing store ${location.NAME} #${location.STORENUMBER}`);

      const patch = {
        provider_id: "thrifty_white",
        provider_location_id: location.STORENUMBER,
        provider_brand_id: Stores.providerBrand.id,
        name: location.NAME,
        address: _.trim([location.ADDRESS1, location.ADDRESS2].join(" ")),
        city: location.CITY,
        state: location.STATE,
        postal_code: location.ZIP,
        location: `point(${location.YCOORD} ${location.XCOORD})`,
        location_source: "provider",
        metadata_raw: location,
      };
      setComputedStoreValues(patch);

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
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

module.exports = Stores;
