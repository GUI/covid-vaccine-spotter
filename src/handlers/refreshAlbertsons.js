const _ = require('lodash');
const got = require('got');
const retry = require('p-retry');
const { Mutex } = require('async-mutex');
const { default: PQueue } = require('p-queue');
const { DateTime } = require('luxon');
const sleep = require('sleep-promise');
const albertsonsAuth = require('../albertsons/auth');
const logger = require('../logger');
const { Store } = require('../models/Store');

const authMutexes = {};
requestsSinceRefresh = 0;

const Albertsons = {
  refreshStores: async () => {
    const queue = new PQueue({ concurrency: 5 });

    const stores = await Store.query()
      .where('brand', 'albertsons')
      .whereRaw(
        "(carries_vaccine = true AND (appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes')))"
      )
      .orderByRaw('appointments_last_fetched NULLS FIRST');
    for (const [index, store] of stores.entries()) {
      queue.add(() => Albertsons.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();
  },

  refreshStore: async (store, index, count) => {
    logger.info(
      `Processing ${store.name} #${store.brand_id} (${
        index + 1
      } of ${count})...`
    );

    const authParam = store.metadata_raw.coachUrlRedirect.params.p;
    if (!authMutexes[authParam]) {
      authMutexes[authParam] = new Mutex();
    }

    await sleep(_.random(250, 750));

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {
        loadEventSlotDaysForCoach: [],
        loadEventSlotsForCoach: [],
      },
    };

    const now = DateTime.now().setZone(store.time_zone);
    const nextMonth = now.plus({ months: 1 });
    const months = [now, nextMonth];

    let slotDates = [];
    for (const month of months) {
      const daysResp = await retry(
        async () => Albertsons.fetchDays(store, authParam, month),
        {
          retries: 2,
          onFailedAttempt: async (err) =>
            Albertsons.onFailedAttempt(err, authParam),
        }
      );

      patch.appointments_raw.loadEventSlotDaysForCoach.push(daysResp.body);
      slotDates = slotDates.concat(daysResp.body.slotDates);
    }

    let slots = [];
    for (const date of slotDates) {
      const slotsResp = await retry(
        async () => Albertsons.fetchSlots(store, authParam, date),
        {
          retries: 2,
          onFailedAttempt: async (err) =>
            Albertsons.onFailedAttempt(err, authParam),
        }
      );

      patch.appointments_raw.loadEventSlotsForCoach.push(slotsResp.body);
      slots = slots.concat(slotsResp.body);
    }

    patch.appointments = slots.map((slot) =>
      DateTime.fromFormat(
        `${slot.date} ${slot.startTime}`,
        'LL/dd/yyyy hh:mm a',
        { zone: store.time_zone }
      ).toISO()
    );
    patch.appointments.sort();

    if (patch.appointments.length > 0) {
      patch.appointments_available = true;
    }

    await Store.query().findById(store.id).patch(patch);

    await sleep(_.random(250, 750));
  },

  fetchDays: async (store, authParam, month) => {
    console.info('  Fetching days with open appointments...');
    const auth = await authMutexes[authParam].runExclusive(async () =>
      albertsonsAuth.get(authParam)
    );
    return got.post(
      'https://kordinator.mhealthcoach.net/loadEventSlotDaysForCoach.do',
      {
        searchParams: {
          cva: 'true',
          type: 'registration',
          _r: _.random(0, 999999999999),
          csrfKey: auth.body.csrfKey,
        },
        headers: {
          'User-Agent':
            'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        },
        cookieJar: auth.cookieJar,
        responseType: 'json',
        form: {
          slotsYear: month.year,
          slotsMonth: month.month,
          forceAllAgents: '',
          manualOptionAgents: '',
          companyName:
            store.metadata_raw.loadLocationsForClientAndApptType.clientName,
          eventType: 'COVID Vaccine Dose 1 Appt',
          eventTitle: '',
          location: store.metadata_raw.loadLocationsForClientAndApptType.name,
          locationTimezone: store.time_zone,
          csrfKey: auth.body.csrfKey,
        },
        retry: 0,
      }
    );
  },

  fetchSlots: async (store, authParam, date) => {
    console.info(`  Fetching appointments on ${date}...`);
    const auth = await authMutexes[authParam].runExclusive(async () =>
      albertsonsAuth.get(authParam)
    );
    return got.post(
      'https://kordinator.mhealthcoach.net/loadEventSlotsForCoach.do',
      {
        searchParams: {
          cva: 'true',
          type: 'registration',
          _r: _.random(0, 999999999999),
          csrfKey: auth.body.csrfKey,
        },
        headers: {
          'User-Agent':
            'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        },
        cookieJar: auth.cookieJar,
        responseType: 'json',
        form: {
          eventDate: date,
          companyName:
            store.metadata_raw.loadLocationsForClientAndApptType.clientName,
          forceAllAgents: '',
          eventType: 'COVID Vaccine Dose 1 Appt',
          eventTitle: '',
        },
        retry: 0,
      }
    );
  },

  onFailedAttempt: async (err, authParam) => {
    logger.warn(err);
    logger.warn(err?.response?.body);
    logger.warn(
      `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
    );
    if (!authMutexes[authParam].isLocked()) {
      await authMutexes[authParam].runExclusive(async () =>
        albertsonsAuth.refresh(authParam)
      );
    }
  },
};

module.exports.refreshAlbertsons = async () => {
  console.info('hello');
  await Albertsons.refreshStores();
};
