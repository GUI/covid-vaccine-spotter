const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const Socket = require("./Socket");

const normalizedAddressMapping = {
  "1651-se-us-highway-19-crystal-river-fl-34429":
    "1651-se-hwy-19-crystal-river-fl-34429",
  "2054-w-byron-butler-pkwy-perry-fl-32348":
    "2057-s-byron-butler-pkwy-suite-1-perry-fl-32348",
  "2533-thomas-dr-panama-city-beach-fl-32408":
    "2533-thomas-dr-panama-city-fl-32408",
  "541494-us-hwy-1-hilliard-fl-32046": "550969-us-hwy-1-hilliard-fl-32046",
  "703-chaffee-rd-s-jacksonville-fl-32221":
    "703-chaffee-rd-jacksonville-fl-32221",
  "805-e-doctor-martin-luther-tampa-fl-33603":
    "805-e-dr-mlk-jr-blvd-tampa-fl-33603",
  "99-eglin-pkwy-nw-ft-walton-beach-fl-32548":
    "99-eglin-pkwy-nw-fort-walton-beach-fl-32548",
};

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 5 });

    Appointments.addressStoreIds = {};
    Appointments.processedPostalCodes = {};
    Appointments.processedBrandIds = {};

    const stores = await Store.query()
      .where("provider_id", "winn_dixie")
      // .where("postal_code", "32503")
      // .where("postal_code", "39301")
      // .where("postal_code", "39301")
      .whereIn("state", ["FL", "MS"])
      .whereRaw(
        "(appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes'))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() =>
        Appointments.refreshStore(store, index, stores.length, queue)
      );
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static async refreshStore(store, index, count, queue) {
    logger.info(
      `Processing ${store.name} #${store.provider_location_id} (${
        index + 1
      } of ${count})...`
    );

    if (Appointments.processedBrandIds[store.provider_location_id]) {
      logger.info(
        `  Skipping already processed store #${store.id} as part of earlier request.`
      );
      return;
    }
    if (Appointments.processedPostalCodes[store.postal_code]) {
      logger.info(
        `  Skipping already processed zip code ${store.postal_code} as part of earlier request.`
      );
      return;
    }

    // const socket = Socket.getSocketForState(store.state, index % queue.concurrency);
    const socket = new Socket(store.state);
    try {
      const patch = {
        appointments: [],
        appointments_last_fetched: DateTime.utc().toISO(),
        appointments_available: false,
        appointments_raw: {
          messages: [],
        },
      };

      const now = DateTime.now().setZone(store.time_zone);
      const messages = await socket.checkPostalCode(
        store.postal_code,
        now.toISODate()
      );
      for (const message of messages) {
        if (message.type === "output") {
          patch.appointments_raw.messages.push(message);
        }
      }

      const updatedStoreIds = [];
      const storePatches = await Appointments.buildStoreSpecificPatches(
        patch,
        store
      );
      for (const [storeId, storePatch] of Object.entries(storePatches)) {
        Appointments.processedBrandIds[storeId] = true;
        await Store.query().findById(storeId).patch(storePatch);
        updatedStoreIds.push(storeId);
      }

      await Store.query()
        .where("provider_id", "winn_dixie")
        .where("postal_code", store.postal_code)
        .whereNotIn("id", updatedStoreIds)
        .patch(patch);

      Appointments.processedPostalCodes[store.postal_code] = true;
    } finally {
      socket.socket.close();
    }
  }

  static async buildStoreSpecificPatches(basePatch, searchStore) {
    const storeAppointments = {};
    let noAppointmentsMessage = false;
    for (const message of basePatch.appointments_raw.messages) {
      if (
        message.type === "output" &&
        message.data?.text &&
        message.data.text.includes("No appointments available")
      ) {
        noAppointmentsMessage = true;
        break;
      } else if (
        message.type === "output" &&
        message.data?.data?._plugin?.type === "adaptivecards"
      ) {
        let vaccineType;

        const { body } = message.data.data._plugin.payload;
        for (const data of body) {
          if (
            data.type === "ColumnSet" &&
            data?.columns?.[0]?.items?.[0]?.type === "TextBlock" &&
            data?.columns?.[0]?.items?.[0]?.text &&
            data?.columns?.[0]?.items?.[0]?.text.includes("COVID")
          ) {
            vaccineType = data.columns[0].items[0].text;
          }

          if (
            data.type === "Container" &&
            data?.items?.[0].columns?.[0].items?.[1]?.id ===
              "scheduleLocation" &&
            data?.items?.[0].columns?.[1].items?.[0].actions?.[0]?.id ===
              "scheduleLocation"
          ) {
            const storeAddress = data.items[0].columns[0].items[0].text;
            const scheduleData =
              data.items[0].columns[1].items[0].actions[0].data;

            if (!Appointments.addressStoreIds[storeAddress]) {
              let normalizedAddress = normalizedAddressKey(storeAddress);
              console.info("normalizedAddress: ", normalizedAddress);
              if (normalizedAddressMapping[normalizedAddress]) {
                normalizedAddress = normalizedAddressMapping[normalizedAddress];
              }

              let store = await Store.query().findOne({
                provider_id: "winn_dixie",
                normalized_address_key: normalizedAddress,
              });
              if (!store) {
                store = await Store.query()
                  .findOne({
                    provider_id: "winn_dixie",
                    state: searchStore.state,
                  })
                  .orderBy(
                    Store.raw("normalized_address_key <-> ?", normalizedAddress)
                  );
                if (store) {
                  logger.warn(
                    `Store not found for ${normalizedAddress}, falling back to similarity match: ${store.normalized_address_key}`
                  );
                }
              }
              if (!store) {
                throw new Error(`Store not found for ${storeAddress}`);
              }

              Appointments.addressStoreIds[storeAddress] = store.id;
            }
            const storeId = Appointments.addressStoreIds[storeAddress];

            if (!storeAppointments[storeId]) {
              storeAppointments[storeId] = [];
            }
            storeAppointments[storeId].push({
              type: vaccineType,
              date: scheduleData.scheduleDate,
            });
          }
        }
      }
    }

    if (!noAppointmentsMessage && Object.keys(storeAppointments).length === 0) {
      logger.error(
        `Appointments should have been found, but no data detected: ${JSON.stringify(
          basePatch.appointments_raw.messages
        )}`
      );
    }

    const storePatches = {};
    for (const [storeId, appointments] of Object.entries(storeAppointments)) {
      const storePatch = _.cloneDeep(basePatch);
      storePatch.appointments = _.orderBy(appointments, ["date", "type"]);

      if (storePatch.appointments.length > 0) {
        storePatch.appointments_available = true;
      }

      storePatches[storeId] = storePatch;
    }

    return storePatches;
  }
}

module.exports = Appointments;
