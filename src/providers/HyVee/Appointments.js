const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

class HyVeeAppointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 5 });

    const updatedBrandIds = [];
    const lastFetched = DateTime.utc().toISO();
    const resp = await got.post(
      "https://www.hy-vee.com/my-pharmacy/api/graphql",
      {
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
        json: {
          operationName:
            "SearchPharmaciesNearPointWithCovidVaccineAvailability",
          variables: {
            radius: 5000,
            latitude: 39.8283,
            longitude: -98.5795,
          },
          query:
            "query SearchPharmaciesNearPointWithCovidVaccineAvailability($latitude: Float!, $longitude: Float!, $radius: Int! = 10) {\n  searchPharmaciesNearPoint(latitude: $latitude, longitude: $longitude, radius: $radius) {\n    distance\n    location {\n      locationId\n      name\n      nickname\n      phoneNumber\n      businessCode\n      isCovidVaccineAvailable\n      covidVaccineEligibilityTerms\n      address {\n        line1\n        line2\n        city\n        state\n        zip\n        latitude\n        longitude\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
        },
      }
    );

    const count = resp.body.data.searchPharmaciesNearPoint.length;
    for (const [
      index,
      store,
    ] of resp.body.data.searchPharmaciesNearPoint.entries()) {
      logger.info(
        `Processing ${store.location.name} - ${store.location.locationId} (${
          index + 1
        } of ${count})...`
      );

      const raw = _.cloneDeep(resp.body);
      raw.data.searchPharmaciesNearPoint = [store];

      updatedBrandIds.push(store.location.locationId);

      const patch = {
        brand: "hyvee",
        brand_id: store.location.locationId,
        name: store.location.name,
        address: store.location.address.line1,
        city: store.location.address.city,
        state: store.location.address.state,
        postal_code: store.location.address.zip,
        location: `point(${store.location.address.longitude} ${store.location.address.latitude})`,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: store.location.isCovidVaccineAvailable,
        appointments_raw: raw,
      };

      if (
        patch.postal_code === "51305" &&
        patch.state === "IA" &&
        patch.city === "Marcus"
      ) {
        patch.postal_code = "51035";
      }

      queue.add(() =>
        Store.query().insert(patch).onConflict(["brand", "brand_id"]).merge()
      );
    }

    await queue.onIdle();

    await Store.query()
      .where("brand", "hyvee")
      .whereNotIn("brand_id", updatedBrandIds)
      .patch({ appointments_available: false, appointments: [] });

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.brand = 'hyvee'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().raw(`
      UPDATE stores s
      SET location = p.location
      FROM postal_codes p
      WHERE
        s.brand = 'hyvee'
        AND s.location IS NULL
        AND s.postal_code = p.postal_code
    `);

    logger.notice("Finished refreshing appointments for all stores.");
  }
}

module.exports = HyVeeAppointments;
