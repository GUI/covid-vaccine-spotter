const { curly } = require("node-libcurl");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "southeastern_grocers",
      })
      .onConflict(["id"])
      .merge();

    await Stores.findFrescoYMasStores();
    await Stores.findHarveysStores();
    await Stores.findWinnDixieStores();

    await Store.knex().destroy();
  }

  static async findFrescoYMasStores() {
    await ProviderBrand.query()
      .insert({
        provider_id: "southeastern_grocers",
        key: "fresco_y_mas",
        name: "Fresco y Más",
        url: "https://www.frescoymas.com/pharmacy/covid-vaccine",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "southeastern_grocers",
      key: "fresco_y_mas",
    });

    await Stores.importBrand(
      "https://www.frescoymas.com/V2/storelocator/getStores?search=jacksonville,%20fl&strDefaultMiles=1000&filter=",
      providerBrand
    );
  }

  static async findHarveysStores() {
    await ProviderBrand.query()
      .insert({
        provider_id: "southeastern_grocers",
        key: "harveys",
        name: "Harveys",
        url: "https://www.harveyssupermarkets.com/pharmacy/covid-vaccine",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "southeastern_grocers",
      key: "harveys",
    });

    await Stores.importBrand(
      "https://www.harveyssupermarkets.com/V2/storelocator/getStores?search=jacksonville,%20fl&strDefaultMiles=1000&filter=",
      providerBrand
    );
  }

  static async findWinnDixieStores() {
    await ProviderBrand.query()
      .insert({
        provider_id: "southeastern_grocers",
        key: "winn_dixie",
        name: "Winn-Dixie",
        url: "https://www.winndixie.com/pharmacy/covid-vaccine",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "southeastern_grocers",
      key: "winn_dixie",
    });

    await Stores.importBrand(
      "https://www.winndixie.com/V2/storelocator/getStores?search=jacksonville,%20fl&strDefaultMiles=1000&filter=",
      providerBrand
    );
  }

  static async importBrand(url, providerBrand) {
    // Note, using "got" against this URL seems to result in 403s, despite
    // identical headers as curl (including user-agent). Perhaps related to:
    // https://github.com/sindresorhus/got/discussions/1661. So using curl
    // here.
    const { data } = await curly.get(url, defaultCurlOpts);

    const count = data.length;
    for (const [index, store] of data.entries()) {
      if (!store.departmentList.includes("Pharmacy")) {
        logger.info(
          `Skipping store without pharmacy ${store.StoreName} #${
            store.StoreCode
          } (${index + 1} of ${count})`
        );
        continue;
      }

      logger.info(
        `Importing store ${store.StoreName} #${store.StoreCode} (${
          index + 1
        } of ${count})`
      );

      let timeZone;
      switch (store.TimeZone) {
        case "EST":
          timeZone = "America/New_York";
          break;
        case "CST":
          timeZone = "America/Chicago";
          break;
        default:
          throw new Error(`Unknown timezone: ${store.TimeZone}`);
      }

      await Store.query()
        .insert({
          brand: "southeastern_grocers",
          brand_id: `${store.Chain_ID}-${store.StoreCode}`,
          provider_id: "southeastern_grocers",
          provider_location_id: `${store.Chain_ID}-${store.StoreCode}`,
          provider_brand_id: providerBrand.id,
          name: store.StoreName,
          address: store.Address.AddressLine2,
          city: store.Address.City,
          state: store.Address.State,
          postal_code: store.Address.Zipcode,
          time_zone: timeZone,
          location: `point(${store.Location.Longitude} ${store.Location.Latitude})`,
          normalized_address_key: normalizedAddressKey(
            `${store.Address.AddressLine2.replace(/,/g, "")}, ${
              store.Address.City
            }, ${store.Address.State}, ${store.Address.Zipcode}`
          ),
          metadata_raw: store,
          active: false,
        })
        .onConflict(["provider_id", "provider_location_id"])
        .merge();
    }
  }
}

module.exports = Stores;
