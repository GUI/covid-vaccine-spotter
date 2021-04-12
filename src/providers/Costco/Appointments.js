const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { curly } = require("node-libcurl");
const querystring = require("querystring");
const { DateTime } = require("luxon");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const setComputedStoreValues = require("../../setComputedStoreValues");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const { Store } = require("../../models/Store");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 5 });

    const stores = await Store.query()
      .where("provider_id", "costco")
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

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    if (store.metadata_raw?.appointment_plus?.employees?.employeeObjects) {
      for (const employee of store.metadata_raw.appointment_plus.employees
        .employeeObjects) {
        for (const service of store.metadata_raw.appointment_plus
          .employee_services[employee.id].serviceObjects) {
          const slotsResp = await Appointments.fetchSlots(
            store,
            employee.id,
            service.id
          );
          patch.appointments_raw[`${employee.id}-${service.id}`] =
            slotsResp.data;
          for (const [date, dateData] of Object.entries(
            slotsResp.data.data.gridHours
          )) {
            for (const startTime of dateData.timeSlots.startTimestamp) {
              patch.appointments.push({
                appointment_types: [],
                vaccine_types: normalizedVaccineTypes(
                  service.serviceDetails.title
                ),
                type: service.serviceDetails.title,
                time: DateTime.fromFormat(
                  `${date} ${startTime}`,
                  "yyyy-LL-dd HH:mm:ss",
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

  static async fetchSlots(store, employeeId, serviceId) {
    await sleep(_.random(250, 750));

    const now = DateTime.now().setZone(store.time_zone);

    return throwCurlResponseError(
      await curly.get(
        `https://book.appointment-plus.com/book-appointment/get-grid-hours?${querystring.stringify(
          {
            startTimestamp: now.toFormat("yyyy-LL-dd HH:mm:ss"),
            endTimestamp: now
              .plus({ months: 1 })
              .startOf("day")
              .toFormat("yyyy-LL-dd HH:mm:ss"),
            limitNumberOfDaysWithOpenSlots: 5,
            employeeId,
            "services[]": serviceId,
            numberOfSpotsNeeded: 1,
            isStoreHours: "true",
            clientMasterId:
              store.metadata_raw.appointment_plus.client.clientMasterId,
            toTimeZone: "false",
            fromTimeZone: store.metadata_raw.appointment_plus.client.timeZoneId,
            _: _.random(0, 999999999999),
          }
        )}`,
        {
          httpHeader: ["User-Agent: VaccineSpotter.org"],
          acceptEncoding: "gzip",
          timeoutMs: 15000,
        }
      )
    );
  }
}

module.exports = Appointments;
