const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const sleep = require("sleep-promise");
const { curly } = require("node-libcurl");
const querystring = require("querystring");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    const stores = await Store.query()
      .where("provider_id", "kta_super_stores")
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => Appointments.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name} #${store.provider_location_id} (${
        index + 1
      } of ${count})...`
    );

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    for (const jotform of store.metadata_raw.jotform) {
      const types = [];
      if (jotform.vaccine_types.includes("jj")) {
        types.push("Johnson & Johnson");
      }
      if (jotform.vaccine_types.includes("moderna")) {
        types.push("Moderna");
      }
      if (jotform.vaccine_types.includes("pfizer")) {
        types.push("Pfizer");
      }
      const vaccineType = types.join(", ");

      const resp = await Appointments.fetchAppointments(store, jotform.form_id);
      for (const content of Object.values(JSON.parse(resp.data).content)) {
        for (const [date, times] of Object.entries(content)) {
          for (const [time, status] of Object.entries(times)) {
            if (status) {
              patch.appointments.push({
                appointment_types: [],
                vaccine_types: jotform.vaccine_types,
                type: vaccineType,
                time: DateTime.fromFormat(
                  `${date} ${time}`,
                  "yyyy-LL-dd h:mm a",
                  {
                    zone: store.time_zone,
                  }
                ).toISO(),
              });
            }
          }
        }
      }
    }

    patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);

    setComputedStoreValues(patch);

    await Store.query().findById(store.id).patch(patch);
  }

  static async fetchAppointments(store, formId) {
    await sleep(_.random(250, 750));

    return throwCurlResponseError(
      await curly.get(
        `https://hipaa.jotform.com/server.php?firstAvailableDates&${querystring.stringify(
          {
            action: "getAppointments",
            formID: formId,
            timezone: store.time_zone,
            ncTz: Date.now(),
          }
        )}`,
        defaultCurlOpts
      )
    );
  }
}

module.exports = Appointments;
