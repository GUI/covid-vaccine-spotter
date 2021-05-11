/* eslint no-underscore-dangle: ["error", { "allow": ["_plugin"] }] */
/* eslint no-param-reassign: ["error", { ignorePropertyModificationsFor: ["providerClass"] }] */

const _ = require("lodash");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const Socket = require("./Socket");

class Appointments {
  static setup(providerClass) {
    providerClass.urlIdResponses = {};
    providerClass.addressStoreIds = {};
    providerClass.processedPostalCodes = {};
    providerClass.processedStoreIds = {};
  }

  static async refreshStore(providerClass, store, index, count) {
    logger.info(
      `Processing ${store.provider_brand_key || store.provider_id} ${
        store.name
      }, ${store.postal_code} ${store.state} #${store.provider_location_id} (${
        index + 1
      } of ${count})...`
    );

    if (providerClass.processedStoreIds[store.id]) {
      logger.info(
        `  Skipping already processed store #${store.id} as part of earlier request.`
      );
      return;
    }
    if (providerClass.processedPostalCodes[store.postal_code]) {
      logger.info(
        `  Skipping already processed zip code ${store.postal_code} as part of earlier request.`
      );
      return;
    }

    const urlId = providerClass.getSocketUrlId(store);
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

    let resp = providerClass.urlIdResponses[urlId];
    if (!resp) {
      providerClass.urlIdResponses[urlId] = await curly.get(
        `https://c.ateb.com/${urlId}/`,
        {
          ...defaultCurlOpts,
          proxy: process.env.ENLIVEN_HEALTH_PROXY_SERVER,
          proxyUsername: process.env.ENLIVEN_HEALTH_PROXY_USERNAME,
          proxyPassword: process.env.ENLIVEN_HEALTH_PROXY_PASSWORD,
          sslVerifyPeer: false,
        }
      );
      resp = providerClass.urlIdResponses[urlId];
    }

    if (resp.statusCode > 300) {
      if (
        resp.statusCode === 302 &&
        resp.headers.location.includes("appointments-full")
      ) {
        logger.info(`  Store #${store.id} reports appointments are full.`);
        return;
      }

      logger.warn(
        `  Unexpected redirect encountered: ${JSON.stringify(resp.headers)}`
      );
    }

    const socket = new Socket(urlId);
    try {
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

      providerClass.processedPostalCodes[store.postal_code] = true;

      const storePatches = await Appointments.buildStoreSpecificPatches(
        providerClass,
        patch,
        store
      );
      for (const [storeId, storePatch] of Object.entries(storePatches)) {
        providerClass.processedStoreIds[storeId] = true;
        await Store.query().findById(storeId).patch(storePatch);
        updatedStoreIds.push(storeId);
      }
    } finally {
      socket.socket.close();
    }

    await Store.query()
      .where("provider_id", store.provider_id)
      .where("provider_brand_id", store.provider_brand_id)
      .where("postal_code", store.postal_code)
      .whereNotIn("id", updatedStoreIds)
      .patch(patch);
  }

  static async buildStoreSpecificPatches(
    providerClass,
    basePatch,
    searchStore
  ) {
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
            data?.columns?.[0]?.items?.[0]?.text.match(
              /(Moderna|Pfizer|Johnson|Janssen|J\s*&\s*J|J\s*and\s*J)/i
            )
          ) {
            vaccineType = data.columns[0].items[0].text;
          }

          if (
            data.type === "Container" &&
            data?.items?.[0].columns?.[1].items?.[0].actions?.[0]?.id ===
              "scheduleLocation"
          ) {
            const storeAddress = data.items[0].columns[0].items[0].text;
            const scheduleData =
              data.items[0].columns[1].items[0].actions[0].data;

            if (!providerClass.addressStoreIds[storeAddress]) {
              const normalizedAddress = providerClass.getNormalizedAddress(
                normalizedAddressKey(storeAddress)
              );

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

              providerClass.addressStoreIds[storeAddress] = store.id;
            }
            const storeId = providerClass.addressStoreIds[storeAddress];

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
