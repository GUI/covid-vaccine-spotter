const got = require("got");
const sleep = require("sleep-promise");
const cheerio = require("cheerio");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

const KrogerStores = {
  findStores: async () => {
    const importedStores = {};

    const knex = Store.knex();
    const grid = await knex
      .select(
        knex.raw(
          "id, centroid_postal_code, st_y(centroid_location::geometry) AS latitude, st_x(centroid_location::geometry) AS longitude"
        )
      )
      .from("country_grid_220km")
      .orderBy("centroid_postal_code");
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      const resp = await KrogerStores.importStoresInGridCell(
        gridCell,
        importedStores
      );

      if (resp.body.data.length >= 200) {
        logger.error(
          `There may be more stores within the 100 mile radius than returned, since the maximum of 200 stores was returned: ${gridCell.centroid_postal_code}. Check manually or implement smaller grid search.`
        );
      }
    }

    await Store.knex().destroy();
  },

  getTokenResponse: async () => {
    if (!KrogerStores.tokenResponse) {
      KrogerStores.tokenResponse = await got.post(
        "https://api.kroger.com/v1/connect/oauth2/token",
        {
          headers: {
            "User-Agent":
              "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          },
          username: process.env.KROGER_CLIENT_ID,
          password: process.env.KROGER_CLIENT_SECRET,
          responseType: "json",
          form: {
            grant_type: "client_credentials",
          },
          timeout: 30000,
          retry: 0,
        }
      );
    }

    return KrogerStores.tokenResponse;
  },

  importStoresInGridCell: async (gridCell, importedStores) => {
    const tokenResponse = await KrogerStores.getTokenResponse();

    const resp = await got.get("https://api.kroger.com/v1/locations", {
      searchParams: {
        "filter.lat.near": gridCell.latitude,
        "filter.lon.near": gridCell.longitude,
        "filter.radiusInMiles": 100,
        "filter.limit": 200,
        "filter.department": "09",
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        Authorization: `Bearer ${
          tokenResponse.body.access_token
        }`,
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });

    for (const store of resp.body.data) {
      if (importedStores[store.locationId]) {
        logger.info(`  Skipping already imported store ${store.locationId}`);
      } else {
        logger.info(`  Importing store ${store.locationId}`);

        await Store.query()
          .insert({
            brand: "kroger",
            brand_id: store.locationId,
            name: store.name,
            address: store.address.addressLine1,
            city: store.address.city,
            state: store.address.state,
            postal_code: store.address.zipCode,
            location: `point(${store.geolocation.longitude} ${store.geolocation.latitude})`,
            time_zone: store.hours.timezone,
            metadata_raw: store,
          })
          .onConflict(["brand", "brand_id"])
          .merge();

        importedStores[store.locationId] = true;
      }
    }

    return resp;
  },
};

module.exports = KrogerStores;
