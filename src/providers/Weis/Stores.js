const got = require("got");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "weis",
      })
      .onConflict(["id"])
      .merge();

    await ProviderBrand.query()
      .insert({
        provider_id: "weis",
        key: "weis",
        name: "Weis",
        url: "https://www.weismarkets.com/pharmacy-services",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "weis",
      key: "weis",
    });

    const tokenResp = await got("https://www.weismarkets.com/proxy/init", {
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });

    const resp = await got(
      "https://www.weismarkets.com/proxy/store/getall?store_type_ids=1,2,3",
      {
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          Cookie: `XSRF-TOKEN=${tokenResp.body.token}`,
          "x-csrf-token": tokenResp.body.token,
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    );

    const count = resp.body.stores.length;
    for (const [index, store] of resp.body.stores.entries()) {
      if (!store.departments.find((d) => d.name === "Pharmacy")) {
        logger.info(
          `Skipping store without pharmacy ${store.storeName} #${
            store.storeCode
          } (${index + 1} of ${count})`
        );
        continue;
      }

      if (store.storeID === "126") {
        logger.info(
          `Skipping store with duplicate address ${store.storeName} #${
            store.storeCode
          } (${index + 1} of ${count})`
        );
        continue;
      }

      logger.info(
        `Importing store ${store.storeName} #${store.storeID} (${
          index + 1
        } of ${count})`
      );

      await Store.query()
        .insert({
          brand: "weis",
          brand_id: store.storeID,
          provider_id: "weis",
          provider_location_id: store.storeID,
          provider_brand_id: providerBrand.id,
          name: store.storeName,
          address: store.address,
          city: store.city,
          state: store.state,
          postal_code: store.zip,
          location: `point(${store.longitude} ${store.latitude})`,
          normalized_address_key: normalizedAddressKey(
            `${store.address}, ${store.city}, ${store.state}, ${store.zip}`
          ),
          metadata_raw: store,
          active: false,
        })
        .onConflict(["provider_id", "provider_location_id"])
        .merge();
    }

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'weis'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().destroy();
  }
}

module.exports = Stores;
