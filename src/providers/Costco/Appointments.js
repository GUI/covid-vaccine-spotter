const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { curly } = require("node-libcurl");
const querystring = require("querystring");
const { DateTime } = require("luxon");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const setComputedStoreValues = require("../../setComputedStoreValues");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const { Store } = require("../../models/Store");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 10 });

    Appointments.bookingLinkResponses = {};

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

    let bookingLinkAvailable = false;
    if (store.metadata_raw?.appointment_plus?.booking_link) {
      const bookingLinkResp = await Appointments.fetchBookingLink(store);
      if (
        bookingLinkResp.statusCode === 200 &&
        !bookingLinkResp.data.includes(
          "scheduling is not currently available"
        ) &&
        !bookingLinkResp.data.includes("Account Error")
      ) {
        bookingLinkAvailable = true;
      } else {
        patch.appointments_raw.booking_link = bookingLinkResp.data;
        logger.info(
          `Skipping further processing for ${store.name} #${store.provider_location_id}, since the booking link is not available.`
        );
      }
    }

    let storeInSearchResults = false;
    if (
      bookingLinkAvailable &&
      store.metadata_raw?.appointment_plus?.client_master_id &&
      store.metadata_raw?.appointment_plus?.client?.latitude &&
      store.metadata_raw?.appointment_plus?.client?.longitude
    ) {
      const clientResp = await Appointments.fetchClient(store);
      patch.appointments_raw.client = clientResp.client;
      const client = clientResp.data?.clientObjects?.[0];
      if (
        client &&
        client.id === store.metadata_raw.appointment_plus.client.id
      ) {
        storeInSearchResults = true;
      } else {
        logger.info(
          `Skipping further processing for ${store.name} #${store.provider_location_id}, since location is not being returned in search results.`
        );
      }
    }

    if (
      bookingLinkAvailable &&
      storeInSearchResults &&
      store.metadata_raw?.appointment_plus?.employees?.employeeObjects
    ) {
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

  static async fetchBookingLink(store) {
    const bookingLink = store.metadata_raw.appointment_plus.booking_link;
    if (Appointments.bookingLinkResponses[bookingLink]) {
      return Appointments.bookingLinkResponses[bookingLink];
    }

    await sleep(_.random(250, 750));

    Appointments.bookingLinkResponses[bookingLink] = await curly.get(
      store.metadata_raw.appointment_plus.booking_link,
      {
        ...defaultCurlOpts,
        followLocation: true,
      }
    );

    return Appointments.bookingLinkResponses[bookingLink];
  }

  static async fetchClient(store) {
    await sleep(_.random(250, 750));

    return throwCurlResponseError(
      await curly.get(
        `https://book.appointment-plus.com/book-appointment/get-clients?${querystring.stringify(
          {
            clientMasterId:
              store.metadata_raw.appointment_plus.client_master_id,
            pageNumber: "1",
            itemsPerPage: "1",
            keyword: "",
            clientId: "",
            employeeId: "",
            "centerCoordinates[id]": "",
            "centerCoordinates[latitude]":
              store.metadata_raw.appointment_plus.client.latitude,
            "centerCoordinates[longitude]":
              store.metadata_raw.appointment_plus.client.longitude,
            "centerCoordinates[accuracy]": "84541",
            "centerCoordinates[whenAdded]": "",
            "centerCoordinates[searchQuery]": "",
            radiusInKilometers: "10",
            _: _.random(0, 999999999999),
          }
        )}`,
        defaultCurlOpts
      )
    );
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
        defaultCurlOpts
      )
    );
  }
}

module.exports = Appointments;
