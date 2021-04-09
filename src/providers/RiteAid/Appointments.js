const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 5 });

    const stores = await Store.query()
      .where("brand", "rite_aid")
      .whereRaw(
        "(carries_vaccine = true AND (appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes')))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => Appointments.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name} #${store.brand_id} (${
        index + 1
      } of ${count})...`
    );

    await sleep(_.random(250, 750));

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const slotsResp = await Appointments.fetchSlots(store);
    patch.appointments_raw = slotsResp.body;

    if (
      patch.appointments_raw?.Data?.slots?.["1"] ||
      patch.appointments_raw?.Data?.slots?.["2"]
    ) {
      patch.appointments_available = true;
    }

    setComputedStoreValues(patch);

    // Since vaccine types are only set at the store level, don't use the
    // normally computed value by setComputedStoreValues.
    delete patch.appointment_vaccine_types;

    await Store.query().findById(store.id).patch(patch);

    await sleep(_.random(250, 750));
  }

  static async fetchSlots(store) {
    return got("https://www.riteaid.com/services/ext/v2/vaccine/checkSlots", {
      searchParams: {
        storeNumber: store.brand_id,
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)",
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });
  }
}

module.exports = Appointments;
