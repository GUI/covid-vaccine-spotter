const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const { capitalCase } = require("capital-case");
const slugify = require("slugify");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

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

    const queue = new PQueue({ concurrency: 5 });

    const lastFetched = DateTime.utc().toISO();

    const updatedBrandIds = [];
    const resp = await HebAppointments.fetchStatus();
    for (const loc of resp.body.locations) {
      const raw = _.cloneDeep(loc);
      raw.locations = [loc];

      let postalCode = loc.zip;
      if (postalCode && postalCode.length > 5) {
        postalCode = postalCode.substr(0, 5);
      }

      let brandId = loc.storeNumber;
      if (!brandId) {
        brandId = slugify(`${loc.type}-${postalCode}-${loc.street}`, {
          strict: true,
          lower: true,
        });
      }
      updatedBrandIds.push(brandId);

      const patch = {
        brand: "heb",
        brand_id: brandId,
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

      queue.add(() =>
        Store.query().insert(patch).onConflict(["brand", "brand_id"]).merge()
      );
    }

    await queue.onIdle();

    await Store.query()
      .where("brand", "heb")
      .whereNotIn("brand_id", updatedBrandIds)
      .patch({ appointments_available: false, appointments: [] });

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.brand = 'heb'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().raw(`
      UPDATE stores s
      SET location = p.location
      FROM postal_codes p
      WHERE
        s.brand = 'heb'
        AND s.location IS NULL
        AND s.postal_code = p.postal_code
    `);

    logger.notice("Finished refreshing appointments for all stores.");
  },
};

module.exports = HebAppointments;
