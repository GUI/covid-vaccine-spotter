require("dotenv").config();

const got = require("got");
const { Store } = require("./models/Store");
const logger = require("./logger");

class Geocode {
  static async fix() {
    logger.notice("Looking for any geocoding issues to fix...");

    // Fill in locations without postal codes, but with city/states, but trying
    // to find a matching city/state in the postal code table.
    await Store.knex().raw(`
      UPDATE stores
      SET
        location = postal_codes.location,
        location_source = 'postal_codes'
      FROM postal_codes
      WHERE
        stores.location IS NULL
        AND stores.postal_code IS NULL
        AND stores.city IS NOT NULL
        AND stores.state IS NOT NULL
        AND stores.state = postal_codes.state_code
        AND regexp_replace(lower(stores.city), '\\s+', '') = regexp_replace(lower(postal_codes.city), '\\s+', '')
    `);

    // Fill in locations with postal codes by using the postal code location.
    await Store.knex().raw(`
      UPDATE stores
      SET
        location = postal_codes.location,
        location_source = 'postal_codes'
      FROM postal_codes
      WHERE
        stores.location IS NULL
        AND stores.postal_code IS NOT NULL
        AND stores.postal_code = postal_codes.postal_code
    `);

    // For locations that exists, but are outside the state boundaries,
    // fallback to the postal code location.
    await Store.knex().raw(`
      UPDATE stores
      SET
        location = postal_codes.location,
        location_source = 'postal_codes'
      FROM states, postal_codes
      WHERE
        stores.state = states.code
        AND NOT states.boundaries && stores.location
        AND stores.postal_code IS NOT NULL
        AND stores.postal_code = postal_codes.postal_code
        AND postal_codes.state_code = stores.state
    `);

    // For locations that exist outside the state boundaries and without a
    // postal code, unset the location entirely.
    await Store.knex().raw(`
      UPDATE stores
      SET
        location = NULL,
        location_source = NULL
      FROM states
      WHERE
        stores.state = states.code
        AND NOT states.boundaries && stores.location
        AND stores.postal_code IS NULL
    `);

    const stores = await Store.query()
      .whereRaw("location IS NULL AND state IS NOT NULL AND city IS NOT NULL")
      .orderBy("id");
    logger.info(`Geocoding ${stores.length} locations with geocod.io...`);
    const bulkGeocode = {};
    for (const store of stores) {
      bulkGeocode[store.id] = {
        country: "US",
        state: store.state,
        city: store.city,
      };
    }

    const geocodeResp = await got.post("https://api.geocod.io/v1.6/geocode", {
      searchParams: {
        api_key: process.env.GEOCODIO_API_KEY,
      },
      responseType: "json",
      json: bulkGeocode,
      timeout: 90000,
      retry: 0,
    });

    for (const [storeId, bulkResult] of Object.entries(
      geocodeResp.body.results
    )) {
      const result = bulkResult?.response?.results?.[0];
      if (bulkResult?.query?.state !== result?.address_components?.state) {
        logger.warn(
          `States did not match for geocoding result: ${JSON.stringify(
            bulkResult
          )}`
        );
        continue;
      }

      await Store.query()
        .findById(storeId)
        .patch({
          location: `point(${result.location.lng} ${result.location.lat})`,
          location_source: "geocodio",
        });
    }

    const geonamesStores = await Store.query()
      .whereRaw("location IS NULL AND state IS NOT NULL AND city IS NOT NULL")
      .orderBy("id");
    logger.info(
      `Geocoding ${geonamesStores.length} locations with Geonames...`
    );
    for (const [index, store] of geonamesStores.entries()) {
      logger.info(
        `Geocoding ${store.city}, ${store.state} #${store.id} (${
          index + 1
        } of ${geonamesStores.length})...`
      );

      const resp = await got("http://api.geonames.org/searchJSON", {
        searchParams: {
          q: store.city,
          country: "US",
          adminCode1: store.state,
          featureClass: "P",
          maxRows: 5,
          username: process.env.GEONAMES_USERNAME,
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      });

      const result = resp.body?.geonames?.[0];
      if (result) {
        console.info(result);
        await Store.query()
          .findById(store.id)
          .patch({
            location: `point(${result.lng} ${result.lat})`,
            location_source: "geonames",
          });
      }
    }

    await Store.knex().destroy();
  }
}

module.exports = Geocode;
