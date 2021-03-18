const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const got = require("got");
const logger = require("../../logger");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const Socket = require("../EnlivenHealth/Socket");

const normalizedAddressMapping = {
  "6660-fourth-section-rd-brockport-ny-14420":
    "6660-4th-section-rd-brockport-ny-14420",
  "7954-brewerton-rd-cicero-ny-13039": "7952-brewerton-rd-cicero-ny-13039",
  "5885-circle-dr-e-cicero-ny-13039": "7952-brewerton-rd-cicero-ny-13039",
  "3325-w-genesee-st-geddes-ny-13219": "3325-w-genesee-st-syracuse-ny-13219",
  "851-fairport-rd-east-rochester-ny-14445":
    "fairport-marsh-rds-east-rochester-ny-14445",
  "4276-lakeville-rd-geneseo-ny-14454":
    "4287-genesee-valley-plz-geneseo-ny-14454",
  "3953-route-31-liverpool-ny-13090": "3955-route-31-liverpool-ny-13090",
  "1000-hwy-36-n-hornell-ny-14843": "1000-highway-36-n-hornell-ny-14843",
  "500-s-meadow-dr-ithaca-ny-14850": "500-s-meadow-st-ithaca-ny-14850",
  "s-3740-mckinley-pkwy": "3740-mckinley-pkwy-buffalo-ny-14219",
  "3737-mt-read-blvd-rochester-ny-14616":
    "3701-mt-read-blvd-rochester-ny-14616",
  "miller-st-finch-st-newark-ny-14513": "800-w-miller-st-newark-ny-14513",
  "2155-penfield-rd-penfield-ny-14526": "2157-penfield-rd-penfield-ny-14526",
  "wegmans-conference-center-200-market-st-rochester-ny-14624":
    "200-wegmans-market-st-rochester-ny-14624",
};

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    Appointments.addressStoreIds = {};
    Appointments.processedStates = {};
    Appointments.processedStoreIds = {};

    const stores = await Store.query()
      .where("stores.provider_id", "wegmans")
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
    switch (store.state) {
      case "NY":
        urlId = "c7f2e9cb1982412bb53430a84dfd72ad";
        break;
      case "PA":
        urlId = "15f5aede2e3b479b94e35e63c19473dd";
        break;
      case "VA":
        urlId = "a0cdfb37d60d4a85ab01641d82efc1dc";
        break;
    }

    return urlId;
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name}, ${store.state} #${
        store.provider_location_id
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
      url: null,
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
      .where("provider_id", "wegmans")
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
        const { body } = message.data.data._plugin.payload;
        for (const data of body) {
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

      if (storePatch.appointments.length > 0) {
        storePatch.appointments_available = true;
      }

      storePatches[storeId] = storePatch;
    }

    return storePatches;
  }
}

module.exports = Appointments;
