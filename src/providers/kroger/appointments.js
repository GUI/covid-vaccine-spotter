const retry = require("p-retry");
const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const { Mutex } = require("async-mutex");
const logger = require("../../logger");
// const solver = require("../../solver");
const KrogerAuth = require("./auth");
const { Store } = require("../../models/Store");

const authMutex = new Mutex();

class KrogerAppointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    KrogerAppointments.processedPostalCodes = {};
    KrogerAppointments.processedBrandIds = {};

    const stores = await Store.query()
      .where("brand", "kroger")
      .where("state", "CO")
      .whereRaw(
        "(appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes'))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() =>
        KrogerAppointments.refreshStore(store, index, stores.length)
      );
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

    if (KrogerAppointments.processedBrandIds[store.brand_id]) {
      logger.info(
        `  Skipping already processed store #${store.id} as part of earlier request.`
      );
      return;
    }
    if (KrogerAppointments.processedPostalCodes[store.postal_code]) {
      logger.info(
        `  Skipping already processed zip code ${store.postal_code} as part of earlier request.`
      );
      return;
    }

    await sleep(_.random(250, 750));

    const lastFetched = DateTime.utc().toISO();

    const slotsResp = await retry(
      async () => KrogerAppointments.fetchSlots(store),
      {
        retries: 2,
        onFailedAttempt: KrogerAppointments.onFailedAttempt,
      }
    );

    for (const location of slotsResp.body) {
      const brandId = location.loc_no.replace(/^625/, "620");
      logger.info(`  Processing appointment results for store #${brandId}`);

      const locationStore = await Store.query().findOne({
        brand: "kroger",
        brand_id: brandId,
      });
      if (!locationStore) {
        throw new Error(`Store not found for ${brandId}`);
      }

      const patch = {
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: false,
        appointments_raw: { slots: [location] },
      };

      if (location?.dates) {
        patch.appointments = location.dates.reduce(
          (appointments, day) =>
            appointments.concat(
              day.slots.map((slot) => ({
                type: slot.ar_reason,
                time: DateTime.fromFormat(
                  `${day.date} ${slot.start_time}`,
                  "yyyy-LL-dd HH:mm:ss",
                  { zone: locationStore.time_zone }
                ).toISO(),
              }))
            ),
          []
        );
        patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);
      }

      if (patch.appointments.length > 0) {
        patch.appointments_available = true;
      }

      await Store.query().findById(locationStore.id).patch(patch);

      KrogerAppointments.processedBrandIds[brandId] = true;
    }

    KrogerAppointments.processedPostalCodes[store.postal_code] = true;

    await sleep(_.random(250, 750));
  }

  static async fetchSlots(store) {
    logger.info("begin fetchSlots", store.id);
    const auth = await authMutex.runExclusive(KrogerAuth.get);
    logger.info("fetchSlots got auth");

    const startDate = DateTime.now().setZone(store.time_zone);
    const endDate = startDate.plus({ days: 7 });

    logger.info("fetchSlots begin eval");
    const resp = await auth.page.evaluate(
      async (options) => {
        const response = await fetch(
          `https://www.kingsoopers.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/${options.zipCode}/${options.startDate}/${options.endDate}/50?appointmentReason=122&appointmentReason=125`,
          {
            headers: {
              accept: "application/json, text/plain, */*",
              "cache-control": "no-cache",
              pragma: "no-cache",
              "rx-channel": "WEB",
              "x-sec-clge-req-type": "ajax",
            },
          }
        );

        return {
          url: response.url,
          statusCode: response.status,
          headers: response.headers,
          body: await response.text(),
        };
      },
      {
        zipCode: store.postal_code,
        startDate: startDate.toISODate(),
        endDate: endDate.toISODate(),
      }
    );
    logger.info("fetchSlots done eval: ", resp);

    if (resp.statusCode !== 200) {
      throw new got.HTTPError({ ...resp, request: { response: resp } });
    }

    resp.body = JSON.parse(resp.body);

    return resp;
  }

  static async onFailedAttempt(err) {
    logger.info(
      `Error fetching data (${err?.response?.statusCode}), retrying (attempt ${err.attemptNumber}, retries left ${err.retriesLeft})`
    );

    /*
    if (await KrogerAuth.page.isVisible("#sec-overlay")) {
      logger.info("OVERLAY!");
      // await solver(KrogerAuth.page);
    } else {
      logger.info("NO OVERLAY!");
    }
    */

    if (err.retriesLeft === 0) {
      logger.warn(err);
      logger.warn(err?.response);
      logger.warn(err?.response?.body);
      logger.warn(
        `Error fetching data (${err?.response?.statusCode}), last retry attempt`
      );
      if (!authMutex.isLocked()) {
        logger.warn(`Refreshing auth for last retry.`);
        await sleep(5000);
        await authMutex.runExclusive(KrogerAuth.refresh);
      }
    }
  }
}

module.exports = KrogerAppointments;
