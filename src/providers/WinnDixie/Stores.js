const { curly } = require("node-libcurl");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "winn_dixie",
      })
      .onConflict(["id"])
      .merge();

    await ProviderBrand.query()
      .insert({
        provider_id: "winn_dixie",
        key: "winn_dixie",
        name: "Winn-Dixie",
        url: "https://www.winndixie.com/pharmacy/covid-vaccine",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "winn_dixie",
      key: "winn_dixie",
    });

    // Note, using "got" against this URL seems to result in 403s, despite
    // identical headers as curl (including user-agent). Perhaps related to:
    // https://github.com/sindresorhus/got/discussions/1661. So using curl
    // here.
    const { data } = await curly.get(
      "https://www.winndixie.com/V2/storelocator/getStores?search=jacksonville,%20fl&strDefaultMiles=1000&filter=",
      {
        httpHeader: [
          "User-Agent: covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        ],
      }
    );

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
          brand: "winn_dixie",
          brand_id: store.StoreCode,
          provider_id: "winn_dixie",
          provider_location_id: store.StoreCode,
          provider_brand_id: providerBrand.id,
          name: store.StoreName,
          address: store.Address.AddressLine2,
          city: store.Address.City,
          state: store.Address.State,
          postal_code: store.Address.Zipcode,
          time_zone: timeZone,
          location: `point(${store.Location.Longitude} ${store.Location.Latitude})`,
          normalized_address_key: normalizedAddressKey(
            `${store.Address.AddressLine2}, ${store.Address.City}, ${store.Address.State}, ${store.Address.Zipcode}`
          ),
          metadata_raw: store,
          active: false,
        })
        .onConflict(["provider_id", "provider_location_id"])
        .merge();
    }

    await Store.knex().destroy();
  }
}

module.exports = Stores;
