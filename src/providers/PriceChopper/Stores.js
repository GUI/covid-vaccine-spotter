const { curly } = require("node-libcurl");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const normalizedAddressKey = require("../../normalizedAddressKey");

class Stores {
  static async findStores() {
    Stores.importedStores = {};

    await Provider.query()
      .insert({
        id: "price_chopper",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrands = {
      price_chopper: await ProviderBrand.query()
        .insert({
          provider_id: "price_chopper",
          key: "price_chopper",
          name: "Price Chopper",
          url: "https://www.pricechopper.com/covidvaccine/",
        })
        .onConflict(["provider_id", "key"])
        .merge(),
      market_32: await ProviderBrand.query()
        .insert({
          provider_id: "price_chopper",
          key: "price_chopper_market_32",
          name: "Market 32",
          url: "https://www.pricechopper.com/covidvaccine/",
        })
        .onConflict(["provider_id", "key"])
        .merge(),
      market_bistro: await ProviderBrand.query()
        .insert({
          provider_id: "price_chopper",
          key: "price_chopper_market_bistro",
          name: "Market Bistro",
          url: "https://www.pricechopper.com/covidvaccine/",
        })
        .onConflict(["provider_id", "key"])
        .merge(),
    };

    let pageNum = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      hasNextPage = await Stores.importStoresPage(pageNum);
      pageNum += 1;
    }

    await Store.knex().destroy();
  }

  static async importStoresPage(pageNum) {
    await sleep(1000);

    let hasNextPage = false;

    const resp = await curly.get(
      `https://api.momentfeed.com/v1/analytics/api/llp.json?auth_token=XUWEWBYNKILCHSRT&page=${pageNum}&pageSize=100&tags=Pharmacy`,
      {
        httpHeader: ["User-Agent: VaccineSpotter.org"],
        acceptEncoding: "gzip",
        timeoutMs: 15000,
      }
    );

    if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
      const err = new Error(
        `Request failed with status code ${resp.statusCode}`
      );
      err.response = resp;
      throw err;
    }

    for (const store of resp.data) {
      logger.info(`  Importing store ${store.store_info.corporate_id}`);

      let providerBrand = Stores.providerBrands.price_chopper;
      if (store.store_info.name === "Market Bistro") {
        providerBrand = Stores.providerBrands.market_bistro;
      } else if (
        store.store_info.name === "Market 32" ||
        store.store_info.name === "Market32" ||
        store.tags.includes("Market32Locations")
      ) {
        providerBrand = Stores.providerBrands.market_32;
      }

      const patch = {
        provider_id: "price_chopper",
        provider_location_id: store.store_info.corporate_id,
        provider_brand_id: providerBrand.id,
        name: store.store_info.name,
        address: store.store_info.address,
        city: store.store_info.locality,
        state: store.store_info.region,
        postal_code: store.store_info.postcode,
        time_zone: store.store_info.timezone,
        location: `point(${store.store_info.longitude} ${store.store_info.latitude})`,
        location_source: "provider",
        metadata_raw: store,
      };
      patch.brand = patch.provider_id;
      patch.brand_id = patch.provider_location_id;

      patch.normalized_address_key = normalizedAddressKey({
        address: patch.address,
        city: patch.city,
        state: patch.state,
        postal_code: patch.postal_code,
      });

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge();
    }

    if (resp.data.length >= 100) {
      hasNextPage = true;
    }

    return hasNextPage;
  }
}

module.exports = Stores;
