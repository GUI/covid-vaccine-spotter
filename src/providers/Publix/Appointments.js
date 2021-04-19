const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const slug = require("slug");
const cheerio = require("cheerio");
const { Mutex } = require("async-mutex");
const sleep = require("sleep-promise");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const Auth = require("./Auth");
const { Store } = require("../../models/Store");

const stateMutex = new Mutex();
const authMutex = new Mutex();

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    Appointments.stateMetadata = {};

    const queue = new PQueue({ concurrency: 3 });

    const stores = await Store.query()
      .select(Store.raw("stores.*"))
      .select(Store.raw("states.name AS state_name"))
      .select(Store.raw("counties.name AS county_name"))
      .leftJoin("states", "stores.state", "states.code")
      .leftJoin("counties", "stores.county_id", "counties.id")
      .where("provider_id", "publix")
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() => Appointments.refreshStore(store, index, stores.length));
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name} #${store.provider_location_id} ${
        store.state
      } (${index + 1} of ${count})...`
    );

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const stateMetadata = await stateMutex.runExclusive(() =>
      Appointments.getStateMetadata(store)
    );

    if (!stateMetadata.eid) {
      logger.info(
        `  Skipping store without an active state booking link: ${store.state} #${store.provider_location_id}`
      );
    } else if (!stateMetadata.activeCounties[store.county_name]) {
      logger.info(
        `  Skipping store not in active county: ${store.county_name}, ${
          store.state
        } #${store.provider_location_id} (active counties: ${JSON.stringify(
          Object.keys(stateMetadata.activeCounties)
        )})`
      );
    } else {
      const slotsResp = await Appointments.fetchSlots(store, stateMetadata);
      if (slotsResp.data?.Appointments) {
        for (const appointment of slotsResp.data.Appointments) {
          patch.appointments.push({
            appointment_types: [],
            vaccine_types: normalizedVaccineTypes(stateMetadata.vaccineType),
            type: stateMetadata.vaccineType,
            time: DateTime.fromFormat(
              `${appointment.DisplayDate} ${appointment.DisplayTime}`,
              "L/dd/yyyy h:mm a",
              {
                zone: store.time_zone,
              }
            ).toISO(),
          });
        }
      }
      patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);
    }

    setComputedStoreValues(patch);

    await Store.query().findById(store.id).patch(patch);
  }

  static async fetchState(store) {
    await sleep(_.random(250, 750));

    const stateUrlKey = slug(store.state_name);
    const resp = await curly.get(
      `https://www.publix.com/covid-vaccine/${stateUrlKey}`,
      defaultCurlOpts
    );
    return throwCurlResponseError(resp);
  }

  static async fetchStateCounties(store, eid) {
    const auth = await authMutex.runExclusive(Auth.get);

    await sleep(_.random(250, 750));

    const url = `https://rx.publix.com/en/f/s/geo/counties/${store.state}?eid=${eid}`;
    const resp = await curly.get(url, {
      ...defaultCurlOpts,
      httpHeader: [
        "User-Agent: VaccineSpotter.org",
        `Cookie: ${await auth.cookieJar.getCookieString(url)}`,
        `__RequestVerificationToken: ${auth.requestVerificationToken}`,
      ],
    });
    return throwCurlResponseError(resp);
  }

  static async getStateMetadata(store) {
    if (Appointments.stateMetadata[store.state]) {
      return Appointments.stateMetadata[store.state];
    }

    const resp = await Appointments.fetchState(store);
    const $body = cheerio.load(resp.data);
    const bodyText = $body.text();

    let eid;
    const bookingLink = $body("a[href*='eid=']").attr("href");
    if (bookingLink) {
      // eslint-disable-next-line prefer-destructuring
      eid = bookingLink.match(/eid=(\w+)/)[1];
    }

    const activeCounties = {};
    if (eid) {
      const countyResp = await Appointments.fetchStateCounties(store, eid);
      for (const county of countyResp.data.Counties) {
        if (county.Enabled) {
          activeCounties[county.CountyCode] = true;
        }
      }
    }

    const vaccineTypes = [];
    if (/appointments for .*(Johnson|Janssen)/i.test(bodyText)) {
      vaccineTypes.push("Johnson & Johnson");
    }
    if (/appointments for .*Moderna/i.test(bodyText)) {
      vaccineTypes.push("Moderna");
    }
    if (/appointments for .*Pfizer/i.test(bodyText)) {
      vaccineTypes.push("Pfizer");
    }

    Appointments.stateMetadata[store.state] = {
      eid,
      activeCounties,
      vaccineType: vaccineTypes.join(", "),
    };

    return Appointments.stateMetadata[store.state];
  }

  static async fetchSlots(store, stateMetadata) {
    const auth = await authMutex.runExclusive(Auth.get);

    await sleep(_.random(250, 750));

    const storeUrlId = parseInt(store.provider_location_id, 10)
      .toString()
      .padStart(4, "0");
    const url = `https://rx.publix.com/en/f/s/store/appt/${storeUrlId}?eid=${stateMetadata.eid}`;
    const resp = await curly.get(url, {
      ...defaultCurlOpts,
      httpHeader: [
        "User-Agent: VaccineSpotter.org",
        `Cookie: ${await auth.cookieJar.getCookieString(url)}`,
        `__RequestVerificationToken: ${auth.requestVerificationToken}`,
      ],
    });
    return throwCurlResponseError(resp);
  }
}

module.exports = Appointments;
