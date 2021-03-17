const _ = require("lodash");
const got = require("got");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const { State } = require("../../models/State");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "wegmans",
      })
      .onConflict(["id"])
      .merge();

    await ProviderBrand.query()
      .insert({
        provider_id: "wegmans",
        key: "wegmans",
        name: "Wegmans",
        url: "https://www.wegmans.com/covid-vaccine-registration/",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "wegmans",
      key: "wegmans",
    });

    const resp = await got("https://shop.wegmans.com/api/v2/stores", {
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });

    const count = resp.body.items.length;
    for (const [index, store] of resp.body.items.entries()) {
      logger.info(
        `Importing store ${store.name} #${store.id} (${index + 1} of ${count})`
      );

      const state = await State.query().findOne(
        State.raw("lower(name) = ?", store.address.province.toLowerCase())
      );

      const data = {
        brand: "wegmans",
        brand_id: store.id,
        provider_id: "wegmans",
        provider_location_id: store.id,
        provider_brand_id: providerBrand.id,
        name: store.name,
        address: store.address.address1,
        city: store.address.city,
        state: state.code,
        postal_code: store.address.postal_code.substr(0, 5),
        location: `point(${store.location.longitude} ${store.location.latitude})`,
        location_source: "provider",
        metadata_raw: store,
        active: false,
      };
      data.normalized_address_key = normalizedAddressKey(
        `${data.address}, ${data.city}, ${data.state}, ${data.postal_code}`
      );

      await Store.query()
        .insert(data)
        .onConflict(["provider_id", "provider_location_id"])
        .merge(_.omit(data, ["active"]));
    }

    // Manually add a conference center location Wegmans is using:
    // https://www.monroecounty.gov/news-2021-02-26-vaccine
    const data = {
      brand: "wegmans",
      brand_id: "wegmans-conference-center-14624",
      provider_id: "wegmans",
      provider_location_id: "wegmans-conference-center-14624",
      provider_brand_id: providerBrand.id,
      name: "Wegmans Conference Center",
      address: "200 Wegmans Market St",
      city: "Rochester",
      state: "NY",
      postal_code: "14624",
      location: `point(-77.694255 43.12212)`,
      location_source: "geocodio",
      active: false,
    };
    data.normalized_address_key = normalizedAddressKey(
      `${data.address}, ${data.city}, ${data.state}, ${data.postal_code}`
    );
    await Store.query()
      .insert(data)
      .onConflict(["provider_id", "provider_location_id"])
      .merge(_.omit(data, ["active"]));

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'wegmans'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().destroy();
  }
}

module.exports = Stores;
