const retry = require("p-retry");
const { Mutex } = require("async-mutex");
const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const Auth = require("./Auth");
const { Store } = require("../../models/Store");

const authMutex = new Mutex();

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 10 });

    const stores = await Store.query()
      .where("brand", "walmart")
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

    const slotsResp = await retry(async () => Appointments.fetchSlots(store), {
      retries: 2,
      onFailedAttempt: async (err) => Appointments.onFailedAttempt(err, store),
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
  }

  static async fetchSlots(store) {
    const auth = await authMutex.runExclusive(Auth.get);
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
          timeout: 30000,
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
  }

  static async onFailedAttempt(err, store) {
    logger.warn(
      `Error fetching data for ${store.name} #${store.brand_id} (${
        err?.response?.statusCode
      }), retrying (attempt ${err.attemptNumber}, retries left ${
        err.retriesLeft
      }): ${JSON.stringify(err?.response?.body)}`
    );
    logger.info(err);
    logger.info(err?.response?.body);

    // message: 'Invalid session. Need to be logged in'
    if (
      err?.response?.statusCode === 400 &&
      err.response?.body?.status === "1000"
    ) {
      logger.warn("Invalid session detected, refreshing auth.");
      if (!authMutex.isLocked()) {
        await authMutex.runExclusive(Auth.refresh);
      }
    }
  }
}

module.exports = Appointments;
