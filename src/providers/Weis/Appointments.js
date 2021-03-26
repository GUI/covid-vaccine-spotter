/* eslint no-underscore-dangle: ["error", { "allow": ["_plugin"] }] */

const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const got = require("got");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const Socket = require("../EnlivenHealth/Socket");

const normalizedAddressMapping = {};

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    Appointments.addressStoreIds = {};
    Appointments.processedStates = {};
    Appointments.processedStoreIds = {};

    const stores = await Store.query()
      .where("stores.provider_id", "weis")
      .whereRaw(
        "(appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes'))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => Appointments.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static getSocketUrlId(store) {
    let urlId;
    if (store.state === "NY") {
      urlId = "3f647956b456425d9c12360db8e4fdb4";
    } else if (store.state === "NJ") {
      urlId = "a650b502db904b0195d640fd68a4a2a0";
    } else if (store.state === "PA") {
      urlId = "8d8feb6dce7d4d598f753362d06d1e64";
    }

    return urlId;
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name} #${store.provider_location_id}, ${
        store.state
      } (${index + 1} of ${count})...`
    );

    if (Appointments.processedStoreIds[store.id]) {
      logger.info(
        `  Skipping already processed store #${store.id} as part of earlier request.`
      );
      return;
    }
    if (Appointments.processedStates[store.state]) {
      logger.info(
        `  Skipping already processed state ${store.state} as part of earlier request.`
      );
      return;
    }

    const urlId = Appointments.getSocketUrlId(store);
    if (!urlId) {
      logger.info(`  Skipping store #${store.id} that doesn't have a URL id`);
      return;
    }

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {
        messages: [],
      },
      active: true,
    };

    const updatedStoreIds = [];

    const url = `https://c.ateb.com/${urlId}/`;
    const resp = await got(url, { followRedirect: false });
    if (resp.statusCode > 300) {
      if (
        resp.statusCode === 302 &&
        resp.headers.location.includes("appointments-full")
      ) {
        logger.info(`  Store #${store.id} reports appointments are full.`);
      } else {
        logger.warn(
          `  Unexpected redirect encountered: ${JSON.stringify(resp.headers)}`
        );
      }
    } else {
      const socket = new Socket(urlId);
      try {
        const now = DateTime.now().setZone(store.time_zone);
        const messages = await socket.checkState(store.state, now.toISODate());
        for (const message of messages) {
          if (message.type === "output") {
            patch.appointments_raw.messages.push(message);
          }
        }

        Appointments.processedStates[store.state] = true;

        const storePatches = await Appointments.buildStoreSpecificPatches(
          patch,
          store
        );
        for (const [storeId, storePatch] of Object.entries(storePatches)) {
          Appointments.processedStoreIds[storeId] = true;
          await Store.query().findById(storeId).patch(storePatch);
          updatedStoreIds.push(storeId);
        }
      } finally {
        socket.socket.close();
      }
    }

    await Store.query()
      .where("provider_id", "weis")
      .where("state", store.state)
      .whereNotIn("id", updatedStoreIds)
      .patch(patch);
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
              if (normalizedAddressMapping[normalizedAddress]) {
                normalizedAddress = normalizedAddressMapping[normalizedAddress];
              }

              let store = await Store.query().findOne({
                provider_id: searchStore.provider_id,
                provider_brand_id: searchStore.provider_brand_id,
                normalized_address_key: normalizedAddress,
              });
              if (!store) {
                store = await Store.query()
                  .findOne({
                    provider_id: searchStore.provider_id,
                    provider_brand_id: searchStore.provider_brand_id,
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
              appointment_types: [],
              vaccine_types: normalizedVaccineTypes(vaccineType),
              type: vaccineType,
              date: scheduleData.scheduleDate,
            });
          }
        }
      }
    }

    if (!noAppointmentsMessage && Object.keys(storeAppointments).length === 0) {
      throw new Error(
        `Appointments should have been found, but no data detected: ${JSON.stringify(
          basePatch.appointments_raw.messages
        )}`
      );
    }

    const storePatches = {};
    for (const [storeId, appointments] of Object.entries(storeAppointments)) {
      const storePatch = _.cloneDeep(basePatch);
      storePatch.appointments = _.orderBy(appointments, ["date", "type"]);

      setComputedStoreValues(storePatch);

      storePatches[storeId] = storePatch;
    }

    return storePatches;
  }
}

module.exports = Appointments;
