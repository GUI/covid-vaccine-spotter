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
      provider_id: "health_mart",
      key: "health_mart",
    });

    const queue = new PQueue({ concurrency: 5 });

    const updatedStoreIds = [];
    const lastFetched = DateTime.utc().toISO();
    const resp = await curly.get(
      "https://scrcxp.pdhi.com/ScreeningEvent/fed87cd2-f120-48cc-b098-d72668838d8b/GetLocations",
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
        const data = {
          provider_id: "health_mart",
          provider_brand_id: Appointments.providerBrand.id,
          name: rawStore.name,
          address: rawStore.address1,
          city: rawStore.city,
          state: rawStore.state.toUpperCase(),
          postal_code: rawStore.zipCode.padStart(5, "0"),
        };
        data.normalized_address_key = normalizedAddressKey({
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
        });

        // As of 2021-05-12, `visibileTimeSlots` is no longer being returned in
        // the API, so we don't actually get specific timeslots. Timeslots are
        // available via another API call, but that would require API calls for
        // each individual store, so we will skip that for now and just return
        // the booelan appointment status for now.
        const appointments = rawStore.visibleTimeSlots.map((slot) => ({
          time: DateTime.fromFormat(slot.time, "yyyy-LL-dd'T'HH:mm:ss", {
            zone: rawStore.timeZone,
          }).toISO(),
        }));

        const patch = {
          // If the store is seen, then the assumption is that it has
          // appointments.
          appointments_available: true,
          appointments,
          appointments_last_fetched: lastFetched,
          appointments_raw: rawStore,
          time_zone: rawStore.timeZone,
        };
        setComputedStoreValues(patch);

        let store = await Store.query().findOne({
          provider_id: data.provider_id,
          normalized_address_key: data.normalized_address_key,
        });
        if (!store && rawStore.telephoneNumber) {
          const phone = rawStore.telephoneNumber.replace(/[^0-9]/g, "");
          if (phone) {
            store = await Store.query()
              .findOne({
                provider_id: data.provider_id,
                state: data.state,
                postal_code: data.postal_code,
              })
              .whereRaw(
                "regexp_replace(metadata_raw->>'Phone', '[^0-9]', '') = ?",
                phone
              );
            if (store) {
              logger.info(
                `Store not found for ${data.normalized_address_key}, falling back to phone match: ${store.provider_location_id} - ${store.normalized_address_key}`
              );
            }
          }
        }

        if (!store) {
          store = await Store.query()
            .findOne({
              provider_id: data.provider_id,
              state: data.state,
              postal_code: data.postal_code,
            })
            .orderBy(
              Store.raw(
                "normalized_address_key <-> ?",
                data.normalized_address_key
              )
            );
          if (store) {
            logger.info(
              `Store not found for ${data.normalized_address_key}, falling back to similarity match: ${store.provider_location_id} - ${store.normalized_address_key}`
            );
          }
        }

        if (store) {
          updatedStoreIds.push(store.id);
          return Store.query().findById(store.id).patch(patch);
        }

        logger.warn(
          `Store not found for ${data.normalized_address_key} or fallback, creating new store.`
        );
        const insert = {
          ...data,
          ...patch,
          provider_location_id: data.normalized_address_key,
        };
        setComputedStoreValues(insert);
        await Geocode.fillInMissingForStore(insert);
        const newStore = await Store.query().insert(insert);
        updatedStoreIds.push(newStore.id);
        return newStore;
      });
    }

    await queue.onIdle();

    await Store.query()
      .where("provider_id", "health_mart")
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
