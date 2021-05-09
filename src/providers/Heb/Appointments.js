const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const { capitalCase } = require("capital-case");
const slug = require("slug");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

const HebAppointments = {
  fetchStatus: async () =>
    got(
      "https://heb-ecom-covid-vaccine.hebdigital-prd.com/vaccine_locations.json",
      {
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          Referer: "https://vaccine.heb.com",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    ),

  refreshStores: async () => {
    logger.notice("Begin refreshing appointments for all stores...");

    await Provider.query()
      .insert({
        id: "heb",
      })
      .onConflict(["id"])
      .merge();

    await ProviderBrand.query()
      .insert({
        provider_id: "heb",
        key: "heb",
        name: "H-E-B Pharmacy",
        url: "https://vaccine.heb.com/scheduler",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "heb",
      key: "heb",
    });

    const queue = new PQueue({ concurrency: 5 });

    const lastFetched = DateTime.utc().toISO();

    const updatedProviderLocationIds = [];
    const resp = await HebAppointments.fetchStatus();
    for (const loc of resp.body.locations) {
      const raw = _.cloneDeep(loc);
      raw.locations = [loc];

      let postalCode = loc.zip;
      if (postalCode && postalCode.length > 5) {
        postalCode = postalCode.substr(0, 5);
      }

      let providerLocationId = loc.storeNumber;
      if (!providerLocationId) {
        providerLocationId = slug(`${loc.type}-${postalCode}-${loc.street}`);
      }
      updatedProviderLocationIds.push(providerLocationId);

      const patch = {
        provider_id: "heb",
        provider_location_id: providerLocationId,
        provider_brand_id: providerBrand.id,
        name: loc.name,
        address: capitalCase(loc.street),
        city: capitalCase(loc.city),
        state: loc.state,
        postal_code: postalCode,
        carries_vaccine: true,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: parseInt(loc.openAppointmentSlots, 10) > 0,
        appointments_raw: raw,
      };

      if (loc.latitude && loc.longitude) {
        patch.location = `point(${loc.longitude} ${loc.latitude})`;
      }

      setComputedStoreValues(patch);

      queue.add(() =>
        Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge()
      );
    }

    await queue.onIdle();

    await Store.query()
      .where("provider_id", "heb")
      .whereNotIn("provider_location_id", updatedProviderLocationIds)
      .patch({ appointments_available: false, appointments: [] });

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'heb'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().raw(`
      UPDATE stores s
      SET location = p.location
      FROM postal_codes p
      WHERE
        s.provider_id = 'heb'
        AND s.location IS NULL
        AND s.postal_code = p.postal_code
    `);

    logger.notice("Finished refreshing appointments for all stores.");
  },
};

module.exports = HebAppointments;
