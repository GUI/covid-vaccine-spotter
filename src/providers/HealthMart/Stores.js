const _ = require("lodash");
const { curly } = require("node-libcurl");
const sleep = require("sleep-promise");
const htmlEntities = require("html-entities");
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
        id: "health_mart",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "health_mart",
        key: "health_mart",
        name: "Health Mart",
        url: "https://www.healthmartcovidvaccine.com/",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const knex = Store.knex();
    const grid = await knex
      .select(
        knex.raw(
          "id, centroid_postal_code, st_y(centroid_location::geometry) AS latitude, st_x(centroid_location::geometry) AS longitude"
        )
      )
      .whereRaw("centroid_postal_code_state_code != 'CA'")
      .from("country_grid_55km")
      .orderBy("centroid_postal_code");
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      await Stores.importStoresInGridCell(gridCell);
    }

    await Store.knex().destroy();
  }

  static async importStoresInGridCell(gridCell) {
    await sleep(1000);

    const resp = await curly.get(
      `https://native.healthmart.com/HmNativeSvc/SearchByGpsAllNoState/${gridCell.latitude}/${gridCell.longitude}?apikey=180A0FF6-6659-44EA-8E03-2BE22C2B27A3`,
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
      if (Stores.importedStores[store.StoreId]) {
        logger.info(`  Skipping already imported store ${store.StoreId}`);
        continue;
      }

      logger.info(`  Importing store ${store.StoreId}`);

      let postalCode = _.trim(store.Zip).substr(0, 5);
      if (
        postalCode === "34699" &&
        store.State === "FL" &&
        store.City === "Tarpon Springs"
      ) {
        postalCode = "34689";
      }

      const patch = {
        provider_id: "health_mart",
        provider_location_id: store.StoreId.toString(),
        provider_brand_id: Stores.providerBrand.id,
        name: htmlEntities.decode(htmlEntities.decode(store.StoreName)),
        address: htmlEntities.decode(htmlEntities.decode(store.Address)),
        city: htmlEntities.decode(htmlEntities.decode(store.City)),
        state: store.State.toUpperCase(),
        postal_code: postalCode,
        location: `point(${store.Lon} ${store.Lat})`,
        location_source: "provider",
        metadata_raw: store,
      };
      patch.brand = patch.provider_id;
      patch.brand_id = patch.provider_location_id;

      if (
        patch.provider_location_id === "9714" &&
        patch.address === "1 SKIDAWAY VILLAGE WALK" &&
        patch.name === "LO COST PHARMACY"
      ) {
        patch.address = "612 E 69th St";
        patch.city = "Savannah";
        patch.state = "GA";
        patch.postal_code = "31405";
      } else if (
        patch.provider_location_id === "21502" &&
        patch.address === "2224 OLD MIDDLEFIELD WAY" &&
        patch.name === "NOWRX SPECIALTY"
      ) {
        patch.address = "7067 Commerce Circle";
        patch.city = "Pleasanton";
        patch.state = "CA";
        patch.postal_code = "94588";
      } else if (
        patch.provider_location_id === "17703" &&
        patch.address === "1228 COLONIAL COMMONS CT." &&
        patch.name === "L R FAMILY PHY"
      ) {
        patch.address = "1755 Airport Rd Suite 100";
        patch.city = "Lancaster";
        patch.state = "SC";
        patch.postal_code = "29720";
      }

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

      Stores.importedStores[store.StoreId] = true;
    }

    return resp;
  }
}

module.exports = Stores;
