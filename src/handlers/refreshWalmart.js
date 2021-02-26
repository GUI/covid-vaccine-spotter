const retry = require("p-retry");
const { Mutex } = require("async-mutex");
const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const logger = require("../logger");
const walmartAuth = require("../walmart/auth");
const { Store } = require("../models/Store");

const authMutex = new Mutex();

const Walmart = {
  refreshStores: async () => {
    const queue = new PQueue({ concurrency: 5 });

    const stores = await Store.query()
      .where("brand", "walmart")
      .whereRaw(
        "(carries_vaccine = true AND (appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes')))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => Walmart.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();
  },

  refreshStore: async (store, index, count) => {
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

    const slotsResp = await retry(async () => Walmart.fetchSlots(store), {
      retries: 2,
      onFailedAttempt: Walmart.onFailedAttempt,
    });

    patch.appointments_raw = slotsResp.body;
    if (patch.appointments_raw?.data?.slotDays) {
      patch.appointments = patch.appointments_raw.data.slotDays.reduce(
        (appointments, day) =>
          appointments.concat(
            day.slots.map((slot) =>
              DateTime.fromFormat(
                `${day.slotDate} ${slot.startTime}`,
                "LLddyyyy H:mm",
                { zone: store.time_zone }
              ).toISO()
            )
          ),
        []
      );
      patch.appointments.sort();
    }

    if (patch.appointments.length > 0) {
      patch.appointments_available = true;
    }

    await Store.query().findById(store.id).patch(patch);

    await sleep(_.random(250, 750));
  },

  fetchSlots: async (store) => {
    const auth = await authMutex.runExclusive(walmartAuth.get);
    const now = DateTime.now().setZone(store.time_zone);
    try {
      return await got.post(
        `https://www.walmart.com/pharmacy/v2/clinical-services/time-slots/${auth.body.payload.cid}`,
        {
          headers: {
            "User-Agent":
              "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          },
          cookieJar: auth.cookieJar,
          responseType: "json",
          json: {
            startDate: now.toFormat("LLddyyyy"),
            endDate: now.plus({ days: 6 }).toFormat("LLddyyyy"),
            imzStoreNumber: {
              USStoreId: parseInt(store.brand_id, 10),
            },
          },
          retry: 0,
        }
      );
    } catch (err) {
      if (err.response?.body?.status === "2100") {
        logger.warn("Time zone incorrect for store?", err);
        logger.warn(err?.response?.body);
        return err.response;
      }
      throw err;
    }
  },

  onFailedAttempt: async (err) => {
    logger.warn(err);
    logger.warn(err?.response?.body);
    logger.warn(
      `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
    );
    if (!authMutex.isLocked()) {
      await authMutex.runExclusive(walmartAuth.refresh);
    }
  },
};

module.exports.refreshWalmart = async () => {
  await Walmart.refreshStores();
};
