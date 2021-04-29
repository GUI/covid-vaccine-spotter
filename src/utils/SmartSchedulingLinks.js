const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const pThrottle = require("p-throttle");
const util = require("util");
const stream = require("stream");
const _ = require("lodash");
const got = require("got");
const ndjson = require("ndjson");
const logger = require("../logger");
const setComputedStoreValues = require("../setComputedStoreValues");
const normalizedVaccineTypes = require("../normalizedVaccineTypes");
const { Store } = require("../models/Store");
const { Provider } = require("../models/Provider");
const { ProviderBrand } = require("../models/ProviderBrand");
const { County } = require("../models/County");
const Geocode = require("../Geocode");

const pipeline = util.promisify(stream.pipeline);

class SmartSchedulingLinks {
  static async processManifest(providerBrandPatch, manifestUrl, options = {}) {
    logger.notice(
      `Begin refreshing appointments for ${providerBrandPatch.provider_id}...`
    );

    await Provider.query()
      .insert({
        id: providerBrandPatch.provider_id,
      })
      .onConflict(["id"])
      .merge();

    const providerBrand = await ProviderBrand.query()
      .insert(providerBrandPatch)
      .onConflict(["provider_id", "key"])
      .merge();

    const lastFetched = DateTime.utc().toISO();

    logger.info(`Processing manifest ${manifestUrl}`);
    const resp = await got(manifestUrl, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });

    const manifestLocations = resp.body.output.filter(
      (o) => o.type === "Location"
    );
    const manifestSchedules = resp.body.output.filter(
      (o) => o.type === "Schedule"
    );
    const manifestSlots = resp.body.output.filter((o) => o.type === "Slot");

    const locations = {};
    for (const manifestLocation of manifestLocations) {
      await SmartSchedulingLinks.processLocation({
        manifestLocation,
        locations,
        options,
      });
    }

    const schedules = {};
    for (const manifestSchedule of manifestSchedules) {
      await SmartSchedulingLinks.processSchedule({
        manifestSchedule,
        schedules,
        options,
      });
    }

    const slotsByLocation = {};
    for (const manifestSlot of manifestSlots) {
      await SmartSchedulingLinks.processSlot({
        manifestSlot,
        schedules,
        slotsByLocation,
        options,
      });
    }

    const geocodeThrottle = pThrottle({
      limit: 1,
      interval: 1000,
    });
    const queue = new PQueue({ concurrency: 5 });
    for (const [locationReference, location] of Object.entries(locations)) {
      queue.add(async () => {
        await SmartSchedulingLinks.patchStore({
          locationReference,
          location,
          slotsByLocation,
          schedules,
          providerBrand,
          lastFetched,
          geocodeThrottle,
        });
      });
    }
    await queue.onIdle();

    logger.notice(
      `Finished refreshing appointments for ${providerBrandPatch.provider_id}.`
    );
  }

  static async processLocation({ manifestLocation, locations, options }) {
    logger.info(`Processing manifest location ${manifestLocation.url}`);

    const respStream = got.stream(manifestLocation.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async (source) => {
      for await (const location of source) {
        // eslint-disable-next-line no-param-reassign
        locations[`Location/${location.id}`] = location;
      }
    });
  }

  static async processSchedule({ manifestSchedule, schedules, options }) {
    logger.info(`Processing manifest schedule ${manifestSchedule.url}`);

    const respStream = got.stream(manifestSchedule.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async (source) => {
      for await (const schedule of source) {
        // eslint-disable-next-line no-param-reassign
        schedules[`Schedule/${schedule.id}`] = schedule;
      }
    });
  }

  static async processSlot({
    manifestSlot,
    schedules,
    slotsByLocation,
    options,
  }) {
    logger.info(`Processing manifest slot ${manifestSlot.url}`);

    const respStream = got.stream(manifestSlot.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async (source) => {
      for await (const slot of source) {
        const schedule = schedules[slot.schedule.reference];

        if (!schedule) {
          logger.warn(`Slot with missing schedule: ${JSON.stringify(slot)}`);
          continue;
        }

        for (const scheduleActor of schedule.actor) {
          if (!slotsByLocation[scheduleActor.reference]) {
            // eslint-disable-next-line no-param-reassign
            slotsByLocation[scheduleActor.reference] = [];
          }

          // eslint-disable-next-line no-param-reassign
          slotsByLocation[scheduleActor.reference].push(slot);
        }
      }
    });
  }

  static async patchStore({
    locationReference,
    location,
    slotsByLocation,
    schedules,
    providerBrand,
    lastFetched,
    geocodeThrottle,
  }) {
    const locationSlots = slotsByLocation[locationReference] || [];
    const locationSchedules = locationSlots.map(
      (slot) => schedules[slot.schedule.reference]
    );

    const patch = {
      provider_id: providerBrand.provider_id,
      provider_location_id: location.id,
      provider_brand_id: providerBrand.id,
      name: location.name,
      address: location.address.line.join("\n"),
      city: location.address.city,
      state: location.address.state,
      postal_code: location.address.postalCode.substr(0, 5),
      metadata_raw: location,
      appointments: [],
      appointments_last_fetched: lastFetched,
      appointments_available: false,
      appointments_raw: {
        schedules: locationSchedules,
        slots: locationSlots,
      },
      active: false,
    };

    if (location.position?.latitude && location.position?.longitude) {
      patch.location = `point(${location.position.longitude} ${location.position.latitude})`;
      patch.location_source = "provider";
    }

    const store = await Store.query().findOne({
      provider_id: patch.provider_id,
      provider_location_id: patch.provider_location_id,
    });

    if (store) {
      patch.time_zone = store.time_zone;
      patch.county_id = store.county_id;

      if (!patch.location) {
        patch.location = store.location;
      }
    }

    if (!patch.time_zone || !patch.location) {
      await geocodeThrottle(async () => {
        await Geocode.fillInMissingForStore(patch, store || null);
      })();
    }

    if (!patch.county_id && location.address.district) {
      const countyRecord = await County.query()
        .whereRaw("state_code = ? AND lower(name) = ?", [
          patch.state,
          location.address.district.toLowerCase(),
        ])
        .first();

      patch.county_id = countyRecord.id;
    }

    for (const slot of locationSlots) {
      if (slot.status === "free") {
        const schedule = schedules[slot.schedule.reference];

        const products = [];
        const doses = [];
        if (schedule.extension) {
          for (const extension of schedule.extension) {
            if (
              extension.url ===
              "http://fhir-registry.smarthealthit.org/StructureDefinition/vaccine-product"
            ) {
              products.push(extension.valueCoding.display);
            } else if (
              extension.url ===
              "http://fhir-registry.smarthealthit.org/StructureDefinition/vaccine-dose"
            ) {
              doses.push(extension.valueInteger);
            }
          }
        }

        const vaccineType = products.join(", ");
        const appointmentTypes = [];
        if (doses.length === 1 && doses[0] === 2) {
          appointmentTypes.push("2nd_dose_only");
        }

        const appointment = {
          appointment_types: appointmentTypes,
          vaccine_types: normalizedVaccineTypes(vaccineType),
        };

        if (vaccineType) {
          appointment.type = vaccineType;
        }

        const startTime = DateTime.fromISO(slot.start, {
          zone: patch.time_zone,
        });
        const endTime = DateTime.fromISO(slot.end, {
          zone: patch.time_zone,
        });
        const timeDiff = endTime.diff(startTime);

        // If the time duration is over 3 hours, then we are assuming this date
        // range represents the entire day, and not actually a specific time
        // slot.
        if (timeDiff.toMillis() > 10800000) {
          appointment.date = startTime.toISODate();
        } else {
          appointment.time = startTime.toISO();
        }

        patch.appointments.push(appointment);
      }
    }

    patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);

    setComputedStoreValues(patch);

    await Store.query()
      .insert(patch)
      .onConflict(["provider_id", "provider_location_id"])
      .merge();
  }
}

module.exports = SmartSchedulingLinks;
