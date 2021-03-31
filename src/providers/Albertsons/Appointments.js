const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const got = require("got");
const { DateTime } = require("luxon");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static async fetchAvailability() {
    return got(
      "https://s3-us-west-2.amazonaws.com/mhc.cdn.content/vaccineAvailability.json",
      {
        searchParams: {
          v: _.random(0, 999999999999),
        },
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    );
  }

  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 10 });

    const resp = await Appointments.fetchAvailability();
    const lastFetched = DateTime.fromHTTP(
      resp.headers["last-modified"]
    ).toISO();
    for (const store of resp.body) {
      const patch = {
        provider_id: "albertsons",
        provider_location_id: store.id,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: store.availability === "yes",
        appointments_raw: store,
      };
      setComputedStoreValues(patch);

      queue.add(() =>
        Store.query()
          .findOne({
            provider_id: patch.provider_id,
            provider_location_id: patch.provider_location_id,
          })
          .patch(patch)
      );
    }

    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }
}

module.exports = Appointments;
