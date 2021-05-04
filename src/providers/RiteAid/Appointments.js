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
      appointment_types: {},
      appointment_vaccine_types: {},
    };

    const slotsResp = await Appointments.fetchSlots(store);
    patch.appointments_raw = slotsResp.body;

    if (patch.appointments_raw?.Data?.slots) {
      // The slot numbers indicate vaccine types. Buried in
      // https://www.riteaid.com/etc.clientlibs/riteaid-web/clientlibs/clientlib-base.min.8d3379aafd4018fd7263848d02b792c5.js
      //
      // 9 - Moderna Dose 1
      // 10 - Moderna Dose 2
      // 11 - Pfizer Dose 1
      // 12 - Pfizer Dose 2
      // 13 - Johnson & Johnson
      //
      // For Moderna & Pfizer, the dose 1 slot value seems to need to be true
      // in order to book, but the dose 2 slot does not actually have to be
      // true. So that's why we are only checking the dose 1 slots.
      if (patch.appointments_raw.Data.slots["9"]) {
        patch.appointments_available = true;
        patch.appointment_vaccine_types.moderna = true;
      }

      if (patch.appointments_raw.Data.slots["11"]) {
        patch.appointments_available = true;
        patch.appointment_vaccine_types.pfizer = true;
      }

      if (patch.appointments_raw.Data.slots["13"]) {
        patch.appointments_available = true;
        patch.appointment_vaccine_types.jj = true;
      }
    }

    // Rite Aid only appears to book all needed doses, so there is no
    // possibility of booking just the first or just the second dose by itself.
    if (patch.appointments_available) {
      patch.appointment_types.all_doses = true;
    }

    setComputedStoreValues(patch);

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
