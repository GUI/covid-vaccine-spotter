const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const { capitalCase } = require("capital-case");
const logger = require("../logger");
const { Store } = require("../models/Store");

const Heb = {
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

    const resp = await Heb.fetchStatus();
    for (const loc of resp.locations) {
      const raw = _.cloneDeep(loc);
      let brandId = `${loc.storeNumber}`;
      if (loc.type === "offsite") {
        brandId = `${loc.type}-${loc.zip}`;
      }
      const patch = {
        brand: "heb",
        brand_id: brandId,
        name: loc.name,
        storeNumber: loc.storeNumber,
        address: loc.street,
        city: capitalCase(loc.city),
        state: loc.state,
        latitude: loc.latitude,
        longitude: loc.longitude,
        carries_vaccine: true,
        appointments: [],
        appointments_last_fetched: lastFetched,
        appointments_available: parseInt(loc.openAppointmentSlots, 10) > 0,
        appointments_raw: raw,
      };

      queue.add(() =>
        Store.query().insert(patch).onConflict(["brand", "brand_id"]).merge()
      );
    }

    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  },
};

module.exports.refreshCvs = async () => {
  await Heb.refreshStores();
};
