const retry = require("p-retry");
const { DateTime } = require("luxon");
const got = require("got");
const { Mutex } = require("async-mutex");
const sleep = require("sleep-promise");
const { default: PQueue } = require("p-queue");
const samsClubAuth = require("../samsClub/auth");
const { Store } = require("../models/Store");
const logger = require("../logger");

const refreshAuthMutex = new Mutex();

const headers = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.5",
  referer:
    "https://www.samsclub.com/pharmacy/immunization/form?imzType=covid&xid=login-success",
  origin: "https://www.samsclub.com",
};

const SamsClub = {
  refreshStores: async () => {
    const queue = new PQueue({ concurrency: 5 });

    const stores = await Store.query()
      .where("brand", "sams_club")
      .whereRaw(
        "(carries_vaccine = false AND appointments_last_fetched <= (now() - interval '1 hour')) OR ((carries_vaccine IS NULL OR carries_vaccine = true) AND (appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes')))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => SamsClub.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();
  },

  refreshStore: async (store, index, count) => {
    logger.info(
      `Processing ${store.name} #${store.brand_id} (${index} of ${count})...`
    );

    const patch = {
      carries_vaccine: false,
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const ageEligibilityResp = await retry(
      () => SamsClub.fetchAgeEligibility(store),
      {
        retries: 2,
        onFailedAttempt: SamsClub.onFailedAttempt,
      }
    );

    patch.appointments_raw.ageEligibility = ageEligibilityResp.body;

    if (ageEligibilityResp.body?.errors?.[0]?.code === "4002") {
      logger.info(
        `Skipping store #${store.brand_id} since store does not carry the vaccine.`
      );
    } else {
      patch.carries_vaccine = true;

      const slotsResp = await retry(() => SamsClub.fetchSlots(store), {
        retries: 2,
        onFailedAttempt: SamsClub.onFailedAttempt,
      });

      patch.appointments_raw.slots = slotsResp.body;
      patch.appointments = patch.appointments_raw.slots.payload.slotDetails.reduce(
        (appointments, slot) => {
          if (slot.status === "AVAILABLE") {
            appointments.push(
              DateTime.fromFormat(slot.startTime, "yyyy-LL-dd'T'HH:mm:ssZZ", {
                setZone: true,
              }).toISO()
            );
          } else if (slot.status !== "UNAVAILABLE") {
            logger.warn(
              `Unknown slot status, treating as unavailable: ${slot.status}`
            );
          }
          return appointments;
        },
        []
      );
      patch.appointments.sort();

      if (patch.appointments.length > 0) {
        patch.appointments_available = true;
      }
    }

    await Store.query().findById(store.id).patch(patch);

    await sleep(500);
  },

  fetchAgeEligibility: async (store) => {
    const auth = await refreshAuthMutex.runExclusive(samsClubAuth.get);

    try {
      return await got.post(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility",
        {
          headers,
          decompress: true,
          cookieJar: auth.cookieJar,
          responseType: "json",
          json: {
            stateCode: store.state,
            clubNumber: store.brand_id,
            imzType: "COVID",
          },
          http2: true,
          retry: 0,
        }
      );
    } catch (err) {
      if (err.response?.body?.errors?.[0]?.code === "4002") {
        return err.response;
      }
      throw err;
    }
  },

  fetchSlots: async (store) => {
    const auth = await refreshAuthMutex.runExclusive(samsClubAuth.get);
    return got(
      `https://www.samsclub.com/api/node/vivaldi/v1/slots/club/${store.brand_id}`,
      {
        searchParams: {
          membershipType: "BASE",
          numOfDays: "6",
          serviceType: "IMMUNIZATION",
        },
        headers,
        decompress: true,
        cookieJar: auth.cookieJar,
        responseType: "json",
        http2: true,
        retry: 0,
      }
    );
  },

  onFailedAttempt: async (err) => {
    logger.warn(err);
    logger.warn(err?.response?.body);
    logger.warn(
      `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
    );
    if (refreshAuthMutex.isLocked()) {
      await refreshAuthMutex.runExclusive(samsClubAuth.get);
    } else {
      await refreshAuthMutex.runExclusive(samsClubAuth.refresh);
    }
  },
};

module.exports.refreshSamsClub = async () => {
  await SamsClub.refreshStores();
};
