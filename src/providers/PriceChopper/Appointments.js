const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const { curly } = require("node-libcurl");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const { Store } = require("../../models/Store");
const { ProviderBrand } = require("../../models/ProviderBrand");
const normalizedAddressKey = require("../../normalizedAddressKey");
const Geocode = require("../../Geocode");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    Appointments.providerBrand = await ProviderBrand.query().findOne({
      provider_id: "price_chopper",
      key: "price_chopper",
    });

    const queue = new PQueue({ concurrency: 5 });

    const updatedStoreIds = [];
    const lastFetched = DateTime.utc().toISO();
    const resp = await curly.get(
      "https://scrcxp.pdhi.com/ScreeningEvent/e047c75c-a431-41a8-8383-81613f39dd55/GetLocations",
      {
        ...defaultCurlOpts,
        timeoutMs: 60000,
      }
    );

    if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
      const err = new Error(
        `Request failed with status code ${resp.statusCode}`
      );
      err.response = resp;
      throw err;
    }

    const count = resp.data.length;
    for (const [index, rawStore] of resp.data.entries()) {
      logger.info(
        `Processing ${rawStore.name} - ${rawStore.address1}, ${
          rawStore.city
        }, ${rawStore.state} ${rawStore.zipCode} (${index + 1} of ${count})...`
      );

      queue.add(async () => {
        const appointments = rawStore.visibleTimeSlots.map((slot) => ({
          time: DateTime.fromFormat(slot.time, "yyyy-LL-dd'T'HH:mm:ss", {
            zone: rawStore.timeZone,
          }).toISO(),
        }));

        const patch = {
          appointments,
          appointments_last_fetched: lastFetched,
          appointments_raw: rawStore,
        };
        setComputedStoreValues(patch);

        let providerLocationId = rawStore.name.match(/(\d+)\s*$/)[1];
        if (!providerLocationId) {
          throw new Error(
            `Could not find location ID for store: ${rawStore.name}`
          );
        } else {
          providerLocationId = parseInt(providerLocationId, 10);
        }

        let store = await Store.query()
          .findOne({
            provider_id: "price_chopper",
            state: rawStore.state,
            provider_location_id: providerLocationId,
          })
          .whereRaw("(city = ? OR postal_code = ?)", [
            rawStore.city,
            rawStore.zipCode,
          ]);
        if (!store) {
          logger.warn(
            `Store not found for ${rawStore.name}, creating new store.`
          );

          const insert = {
            provider_id: "price_chopper",
            provider_location_id: providerLocationId,
            provider_brand_id: Appointments.providerBrand.id,
            name: rawStore.name,
            address: rawStore.address1,
            city: rawStore.city,
            state: rawStore.state,
            postal_code: rawStore.zipCode,
            time_zone: rawStore.timeZone,
            ...patch,
          };
          insert.normalized_address_key = normalizedAddressKey({
            address: insert.address,
            city: insert.city,
            state: insert.state,
            postal_code: insert.postal_code,
          });
          setComputedStoreValues(insert);
          await Geocode.fillInMissingForStore(insert);
          store = await Store.query().insert(insert);
          console.info("new store: ", store);
        }

        updatedStoreIds.push(store.id);

        return Store.query().findById(store.id).patch(patch);
      });
    }

    await queue.onIdle();

    await Store.query()
      .where("provider_id", "price_chopper")
      .whereNotIn("id", updatedStoreIds)
      .patch({
        appointments_available: false,
        appointments: [],
        appointments_last_fetched: lastFetched,
      });

    logger.notice("Finished refreshing appointments for all stores.");
  }
}

module.exports = Appointments;
