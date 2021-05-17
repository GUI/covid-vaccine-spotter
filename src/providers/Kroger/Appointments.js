const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const { Mutex } = require("async-mutex");
const pThrottle = require("p-throttle");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const { Store } = require("../../models/Store");
const { PostalCode } = require("../../models/PostalCode");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 15 });

    Appointments.gridMutexes = {};
    Appointments.processedPostalCodes = {};
    Appointments.processedProviderLocationIds = {};
    Appointments.requestsMade = 0;
    // Keep at 6 requests per second.
    Appointments.fetchThrottle = pThrottle({
      limit: 1,
      interval: 167,
    });

    const stores = await Store.query()
      .select(Store.raw("stores.*, g.id AS grid_id"))
      .joinRaw(
        "LEFT JOIN state_grid_110km AS g ON g.state_code = stores.state AND st_intersects(stores.location, g.geom)"
      )
      .where("provider_id", "kroger")
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      if (!Appointments.gridMutexes[store.grid_id]) {
        Appointments.gridMutexes[store.grid_id] = new Mutex();
      }

      // Since each search can search a 50 mile radius, try to prevent
      // concurrent requests for overlapping 50 mile grid cells by having a
      // mutex per grid cell. We'll still end up searching all locations (since
      // the 50 mile radius search may not actually return all locations in
      // that 50 mile radius), but by locking on the grid cell, this should
      // ensure once inside `refreshStore`, we can skip stores/zip codes that
      // have already been processed.
      queue.add(() =>
        Appointments.gridMutexes[store.grid_id].runExclusive(async () =>
          Appointments.refreshStore(store, index, stores.length)
        )
      );
    }
    await queue.onIdle();

    logger.notice(
      `Finished refreshing appointments for all stores (${Appointments.requestsMade} requests made)`
    );
  }

  static async refreshStore(store, index, count) {
    logger.info(
      `Processing ${store.name} #${store.provider_location_id} (${
        index + 1
      } of ${count})...`
    );

    if (Appointments.processedProviderLocationIds[store.provider_location_id]) {
      logger.info(
        `  Skipping already processed store #${store.provider_location_id} as part of earlier request.`
      );
      return;
    }
    if (Appointments.processedPostalCodes[store.postal_code]) {
      logger.info(
        `  Skipping already processed zip code ${store.postal_code} as part of earlier request.`
      );
      return;
    }

    let lastFetched;
    let slotsResp;
    try {
      slotsResp = await Appointments.fetchThrottle(async () => {
        lastFetched = DateTime.utc().toISO();
        return Appointments.fetchSlots(store);
      })();
    } catch (err) {
      logger.error(
        `Failed to fetch data for store #${store.provider_location_id}, skipping: ${err}`
      );
      return;
    }

    for (const location of slotsResp.data) {
      const providerLocationId = location.loc_no.replace(/^625/, "620");
      logger.info(
        `  Processing appointment results for store #${providerLocationId}`
      );

      const patch = {
        provider_id: "kroger",
        provider_location_id: providerLocationId,
        active: true,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: false,
        appointments_raw: { slots: [location] },
      };

      const locationStore = await Store.query().findOne({
        provider_id: patch.provider_id,
        provider_location_id: patch.provider_location_id,
      });
      let timeZone;
      if (locationStore) {
        timeZone = locationStore.time_zone;
      } else {
        logger.warn(
          `Store not found for ${providerLocationId}, creating new store`
        );

        let providerBrand;
        if (location.facilityDetails.brand === "THE LITTLE CLINIC") {
          providerBrand = await ProviderBrand.query().findOne({
            provider_id: "kroger",
            key: "the_little_clinic",
          });
        } else if (location.facilityDetails.brand === "COVID") {
          providerBrand = await ProviderBrand.query().findOne({
            provider_id: "kroger",
            key: "covid",
          });
        } else {
          logger.error(
            `Unknown brand, skipping: ${
              location.facilityDetails.brand
            } ${JSON.stringify(location)}`
          );
          continue;
        }

        patch.provider_brand_id = providerBrand.id;
        patch.name = location.facilityDetails.vanityName;
        patch.address = location.facilityDetails.address.address1;
        patch.city = location.facilityDetails.address.city;
        patch.state = location.facilityDetails.address.state;
        patch.postal_code = location.facilityDetails.address.zipCode;

        const postalCode = await PostalCode.query().findOne({
          postal_code: patch.postal_code,
        });

        patch.time_zone = postalCode.time_zone;
        patch.location = postalCode.location;
        patch.location_source = "postal_codes";

        timeZone = postalCode.time_zone;
      }

      if (location?.dates) {
        patch.appointments = location.dates.reduce(
          (appointments, day) =>
            appointments.concat(
              day.slots.map((slot) => ({
                appointment_types: [],
                vaccine_types: normalizedVaccineTypes(slot.ar_reason),
                type: slot.ar_reason,
                time: DateTime.fromFormat(
                  `${day.date} ${slot.start_time}`,
                  "yyyy-LL-dd HH:mm:ss",
                  { zone: timeZone }
                ).toISO(),
              }))
            ),
          []
        );
        patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);
      }

      setComputedStoreValues(patch);

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge();

      Appointments.processedProviderLocationIds[providerLocationId] = true;
    }

    Appointments.processedPostalCodes[store.postal_code] = true;
  }

  static async fetchSlots(store) {
    logger.notice(`${DateTime.now().toISO()} fetchSlots`);
    const startDate = DateTime.now().setZone(store.time_zone);
    const endDate = startDate.plus({ days: 10 });
    const radiusMiles = 50;

    Appointments.requestsMade += 1;
    const resp = throwCurlResponseError(
      await curly.get(
        `https://www.kroger.com/rx/api/anonymous/scheduler/slots/locationsearch/${
          store.postal_code
        }/${startDate.toISODate()}/${endDate.toISODate()}/${radiusMiles}?appointmentReason=131&appointmentReason=134&appointmentReason=137&appointmentReason=122&appointmentReason=125&appointmentReason=129&benefitCode=null`,
        {
          ...defaultCurlOpts,
          httpHeader: [
            "User-Agent: VaccineSpotter.org",
            "Accept: application/json",
            `X-KT-VaccineSpotterId: ${process.env.KROGER_VACCINESPOTTER_ID}`,
          ],
          proxy: process.env.KROGER_PROXY_SERVER,
          proxyUsername: process.env.KROGER_PROXY_USERNAME,
          proxyPassword: process.env.KROGER_PROXY_PASSWORD,
          sslVerifyPeer: false,
        }
      )
    );

    return resp;
  }
}

module.exports = Appointments;
