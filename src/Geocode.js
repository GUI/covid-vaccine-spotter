/* eslint no-param-reassign: ["error", { ignorePropertyModificationsFor: ["patch"] }] */

require("dotenv").config();

const got = require("got");
const { Store } = require("./models/Store");
const { PostalCode } = require("./models/PostalCode");
const logger = require("./logger");

class Geocode {
  static async fillInMissingForStore(patch) {
    if (!patch.location || !patch.time_zone) {
      const store = await Store.query().findOne({
        provider_id: patch.provider_id,
        provider_location_id: patch.provider_location_id,
      });

      const address = patch.address || store?.address;
      const state = patch.state || store?.state;
      const city = patch.city || store?.city;
      const postalCode = patch.postal_code || store?.postal_code;

      if (store?.location && !store?.time_zone) {
        if (postalCode) {
          const postalCodeRecord = await PostalCode.query().findOne({
            postal_code: postalCode,
          });

          if (postalCodeRecord) {
            logger.info(
              `Setting time zone from postal code (${address}, ${city}, ${state} ${postalCode})`
            );
            patch.time_zone = postalCodeRecord.time_zone;
          }
        } else {
          const postalCodeResult = await PostalCode.knex().raw(
            `
            SELECT *
            FROM postal_codes
            ORDER BY postal_codes.location <-> (
              SELECT location
              FROM stores
              WHERE id = ?
            )
            LIMIT 1
          `,
            store.id
          );

          if (postalCodeResult?.rows?.[0]) {
            logger.info(
              `Setting time zone from nearest postal code (${address}, ${city}, ${state} ${postalCode})`
            );
            patch.time_zone = postalCodeResult.rows[0].time_zone;
          }
        }

        if (!patch.time_zone) {
          logger.error(
            `Could not find time zone for location: ${patch.provider_id} ${patch.provider_location_id}`
          );
        }
      }

      if (!store?.location) {
        if (!address) {
          logger.info(
            `Looking up ${city}, ${state} ${postalCode} in postal codes table...`
          );
          let postalCodeRecord;
          if (postalCode) {
            postalCodeRecord = await PostalCode.query().findOne({
              postal_code: postalCode,
            });
          } else if (city && state) {
            postalCodeRecord = await PostalCode.query()
              .where("state_code", patch.state)
              .whereRaw(
                "regexp_replace(lower(city), '\\s+', '') = regexp_replace(lower(?), '\\s+', '')",
                patch.city
              )
              .first();
          }

          if (postalCodeRecord) {
            logger.info(
              `Setting location and time zone from postal code (${address}, ${city}, ${state} ${postalCode})`
            );

            if (!store?.location) {
              patch.location = postalCodeRecord.location;
              patch.location_source = "postal_codes";
            }

            if (!store?.time_zone) {
              patch.time_zone = postalCodeRecord.time_zone;
            }
          }
        }

        if (!patch.location) {
          logger.info(
            `Geocoding ${address}, ${city}, ${state} ${postalCode} with geocod.io...`
          );
          const geocodeResp = await got("https://api.geocod.io/v1.6/geocode", {
            searchParams: {
              api_key: process.env.GEOCODIO_API_KEY,
              country: "US",
              street: address,
              city,
              state,
              postal_code: postalCode,
              limit: 1,
            },
            responseType: "json",
            timeout: 90000,
            retry: 0,
          });

          const result = geocodeResp?.body?.results?.[0];
          if (!result) {
            logger.info(
              `No geocoding results, ignoring (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                geocodeResp.body
              )}`
            );
          } else if (result.accuracy_type === "state") {
            logger.info(
              `Geocoding result for an entire state, ignoring (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                geocodeResp.body
              )}`
            );
          } else if (result.accuracy_score < 0.8) {
            logger.info(
              `Geocoding result does not have a high enough accuracy score, ignoring (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                geocodeResp.body
              )}`
            );
          } else if (state !== result.address_components.state) {
            logger.info(
              `States did not match for geocoding result, ignoring (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                geocodeResp.body
              )}`
            );
          } else {
            logger.info(
              `Setting location and time zone from geocod.io (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                geocodeResp.body
              )}`
            );

            if (city !== result.address_components.city) {
              logger.warn(
                `Cities did not match for geocoding result, but still using (${address}, ${city}, ${state} ${postalCode}): ${JSON.stringify(
                  geocodeResp.body
                )}`
              );
            }

            if (!store?.location) {
              patch.location = `point(${result.location.lng} ${result.location.lat})`;
              patch.location_source = "geocodio";
            }

            if (!store?.time_zone) {
              if (result.address_components.zip) {
                const postalCodeRecord = await PostalCode.query().findOne({
                  postal_code: result.address_components.zip,
                });
                logger.info(
                  `Setting time zone from nearest postal code (${address}, ${city}, ${state} ${postalCode})`
                );
                patch.time_zone = postalCodeRecord.time_zone;
              } else {
                const postalCodeResult = await PostalCode.knex().raw(
                  `
                  SELECT *
                  FROM postal_codes
                  ORDER BY postal_codes.location <-> ?
                  LIMIT 1
                `,
                  patch.location
                );
                console.info(postalCodeResult);
                if (postalCodeResult?.rows?.[0]) {
                  logger.info(
                    `Setting time zone from nearest postal code (${address}, ${city}, ${state} ${postalCode})`
                  );
                  patch.time_zone = postalCodeResult.rows[0].time_zone;
                }
              }
            }
          }
        }

        if (!patch.location) {
          logger.info(
            `Geocoding ${city}, ${state} ${postalCode} with geonames...`
          );
          const geonamesResp = await got("http://api.geonames.org/searchJSON", {
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

          const result = geonamesResp.body?.geonames?.[0];
          if (result) {
            logger.info(
              `Setting location and time zone from geonames (${address}, ${city}, ${state} ${postalCode})`
            );
            patch.location = `point(${result.lng} ${result.lat})`;
            patch.location_source = "geonames";

            const postalCodeResult = await PostalCode.knex().raw(
              `
              SELECT *
              FROM postal_codes
              ORDER BY postal_codes.location <-> ?
              LIMIT 1
            `,
              patch.location
            );
            if (postalCodeResult?.rows?.[0]) {
              logger.info(
                `Setting time zone from nearest postal code (${address}, ${city}, ${state} ${postalCode})`
              );
              patch.time_zone = postalCodeResult.rows[0].time_zone;
            }
          }
        }

        if (!patch.location) {
          logger.error(
            `Could not geocode location: ${patch.provider_id} ${patch.provider_location_id} (${address}, ${city}, ${state} ${postalCode})`
          );
        }

        if (!store?.time_zone && !patch.time_zone) {
          logger.error(
            `Could not find time zone for location: ${patch.provider_id} ${patch.provider_location_id} (${address}, ${city}, ${state} ${postalCode})`
          );
        }
      }
    }
  }

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
