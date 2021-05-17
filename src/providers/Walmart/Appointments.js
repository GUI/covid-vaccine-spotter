const { Mutex } = require("async-mutex");
const pThrottle = require("p-throttle");
const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 15 });

    Appointments.gridMutexes = {};
    Appointments.processedPostalCodes = {};
    Appointments.processedProviderLocationIds = {};
    Appointments.requestsMade = 0;
    // Keep at 5 requests per second.
    Appointments.fetchThrottle = pThrottle({
      limit: 1,
      interval: 200,
    });

    const stores = await Store.query()
      .select(
        Store.raw(
          "stores.id, stores.provider_location_id, stores.name, stores.postal_code, g.id AS grid_id"
        )
      )
      .joinRaw(
        "LEFT JOIN state_grid_110km AS g ON g.state_code = stores.state AND st_intersects(stores.location, g.geom)"
      )
      .where("provider_id", "walmart")
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
    let storesResp;
    try {
      storesResp = await Appointments.fetchThrottle(async () => {
        lastFetched = DateTime.utc().toISO();
        return Appointments.fetchStores(store);
      })();
    } catch (err) {
      logger.error(
        `Failed to fetch data for store #${store.provider_location_id}, skipping: ${err}`
      );
      return;
    }

    for (const location of storesResp.data.data) {
      const providerLocationId = location.number;
      logger.info(
        `  Processing appointment results for store #${providerLocationId}`
      );

      const patch = {
        provider_id: "walmart",
        provider_location_id: providerLocationId,
        active: true,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: false,
        appointments_raw: { stores: location },
      };

      const locationStore = await Store.query().findOne({
        provider_id: patch.provider_id,
        provider_location_id: patch.provider_location_id,
      });
      let timeZone;
      if (locationStore) {
        timeZone = locationStore.time_zone;
      } else {
        logger.error(`Store not found for ${providerLocationId}, skipping`);
        continue;
      }

      if (
        location.inventory === "AVAILABLE" &&
        location.slots === "AVAILABLE"
      ) {
        const vaccineTypes = location.inventoryInfo.reduce(
          (types, inventory) => {
            if (inventory.quantity > 0) {
              let name;
              switch (inventory.productMdsFamId) {
                case 181947:
                  name = "Pfizer";
                  break;
                case 181948:
                  name = "Moderna";
                  break;
                case 182366:
                  name = "Johnson & Johnson";
                  break;
                default:
                  name = inventory.shortName;
                  break;
              }

              types.push(name);
            }

            return types;
          },
          []
        );

        patch.appointments.push({
          appointment_types: [],
          vaccine_types: normalizedVaccineTypes(vaccineTypes.join(", ")),
          type: vaccineTypes.join(", "),
          time: DateTime.fromFormat(
            `${location.slotStartDate} ${location.slotStartTime}`,
            "yyyy-LL-dd HH:mm:ss",
            { zone: timeZone }
          ).toISO(),
        });
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

  static async fetchStores(store) {
    Appointments.requestsMade += 1;
    const resp = throwCurlResponseError(
      await curly.get(
        `https://www.walmart.com/pharmacy/v2/clinical-services/stores?search=${store.postal_code}&imzType=COVID&proximity=50`,
        {
          ...defaultCurlOpts,
          httpHeader: [
            "User-Agent: VaccineSpotter.org",
            "Referer: https://www.walmart.com/pharmacy/clinical-services/immunization/scheduled?imzType=covid",
            "Accept: application/json",
          ],
          proxy: process.env.WALMART_APPOINTMENT_STORES_PROXY_SERVER,
          proxyUsername: process.env.WALMART_APPOINTMENT_STORES_PROXY_USERNAME,
          proxyPassword: process.env.WALMART_APPOINTMENT_STORES_PROXY_PASSWORD,
          sslVerifyPeer: false,
        }
      )
    );

    return resp;
  }
}

module.exports = Appointments;
