const { default: PQueue } = require("p-queue");
const { DateTime } = require("luxon");
const util = require("util");
const stream = require("stream");
const _ = require("lodash");
const got = require("got");
const ndjson = require("ndjson");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const { PostalCode } = require("../../models/PostalCode");
const { County } = require("../../models/County");

const pipeline = util.promisify(stream.pipeline);

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    await Promise.all([
      Appointments.processManifest(
        {
          provider_id: "walgreens",
          key: "walgreens",
          name: "Walgreens",
          url:
            "https://www.walgreens.com/findcare/vaccination/covid-19?ban=covid_vaccine_landing_schedule",
        },
        "https://raw.githubusercontent.com/jmandel/wba-appointment-fetch/gh-pages/$bulk-publish"
      ),
      Appointments.processManifest(
        {
          provider_id: "smart",
          key: "smart",
          name: "SMART Health IT",
          url: "https://smarthealthit.org",
        },
        "https://raw.githubusercontent.com/smart-on-fhir/smart-scheduling-links/master/examples/$bulk-publish"
      ),
      Appointments.processManifest(
        {
          provider_id: "kroger",
          key: "kroger",
          name: "Kroger",
          url: "https://www.kroger.com/rx/covid-eligibility",
        },
        "https://schedulingavbsadev.z20.web.core.windows.net/$bulk-publish"
      ),
      Appointments.processManifest(
        {
          provider_id: "epic",
          key: "epic",
          name: "Epic",
          url: "https://www.epic.com",
        },
        "https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2021/Scheduling/Utility/covid-vaccine-availability/$bulk-publish",
        {
          headers: {
            "Epic-Client-ID": process.env.EPIC_CLIENT_ID,
          },
        }
      ),
      Appointments.processManifest(
        {
          provider_id: "cvs",
          key: "cvs",
          name: "CVS",
          url: "https://www.cvs.com/immunizations/covid-19-vaccine",
        },
        "https://www.cvs.com/immunizations/inventory/data/$bulk-publish"
      ),
      Appointments.processManifest(
        {
          provider_id: "carbon_health",
          key: "carbon_health",
          name: "Carbon Health",
          url: "https://carbonhealth.com",
        },
        "https://api.carbonhealth.com/hib/publicVaccination/$bulk-publish"
      ),
      Appointments.processManifest(
        {
          provider_id: "bsmhealth",
          key: "bsmhealth",
          name: "Bon Secours Mercy Health",
          url: "https://bsmhealth.org",
        },
        "https://chperx-tst.health-partners.org/FHIRTST/api/epic/2021/Scheduling/Utility/covid-vaccine-availability/$bulk-publish",
        {
          headers: {
            "Epic-Client-ID": process.env.BSMHEALTH_EPIC_CLIENT_ID,
          },
        }
      ),
    ]);

    logger.notice("Finished refreshing appointments for all stores.");
  }

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
      await Appointments.processLocation(manifestLocation, locations, options);
    }

    const schedules = {};
    for (const manifestSchedule of manifestSchedules) {
      await Appointments.processSchedule(manifestSchedule, schedules, options);
    }

    const slotsByLocation = {};
    for (const manifestSlot of manifestSlots) {
      await Appointments.processSlot(
        manifestSlot,
        locations,
        schedules,
        slotsByLocation,
        options
      );
    }

    for (const [locationReference, location] of Object.entries(locations)) {
      const locationSlots = slotsByLocation[locationReference] || [];
      const locationSchedules = locationSlots.map(
        (slot) => schedules[slot.schedule.reference]
      );

      // Temporary workaround for unexpected data format in bsmhealth data.
      if (Array.isArray(location.address)) {
        location.address = location.address[0];
      }

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
      };

      if (patch.postal_code === "02986" && patch.state === "RI") {
        // Fix invalid Walgreens zip code.
        patch.postal_code = "02896";
      }

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
      }

      if (!patch.time_zone || !patch.location) {
        const postalCodeRecord = await PostalCode.query().findOne({
          postal_code: patch.postal_code,
        });

        if (!patch.time_zone) {
          patch.time_zone = postalCodeRecord.time_zone;
        }

        if (!patch.location) {
          patch.location = postalCodeRecord.location;
          patch.location_source = "postal_codes";
        }
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

          patch.appointments.push({
            appointment_types: appointmentTypes,
            vaccine_types: normalizedVaccineTypes(vaccineType),
            type: vaccineType,
            time: DateTime.fromISO(slot.start, {
              zone: patch.time_zone,
            }).toISO(),
          });
        }
      }

      patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);

      setComputedStoreValues(patch);

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge();
    }

    /*
    console.info('locations: ', locations);
    console.info('schedules: ', schedules);
    console.info('slotsByLocation: ', slotsByLocation);
    */

    logger.notice(
      `Finished refreshing appointments for ${providerBrandPatch.provider_id}.`
    );
  }

  static async processLocation(manifestLocation, locations, options) {
    const respStream = got.stream(manifestLocation.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async function* (source) {
      for await (const location of source) {
        locations[`Location/${location.id}`] = location;
      }
    });
  }

  static async processSchedule(manifestSchedule, schedules, options) {
    const respStream = got.stream(manifestSchedule.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async function* (source) {
      for await (const schedule of source) {
        schedules[`Schedule/${schedule.id}`] = schedule;
      }
    });
  }

  static async processSlot(
    manifestSlot,
    locations,
    schedules,
    slotsByLocation,
    options
  ) {
    const respStream = got.stream(manifestSlot.url, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
        ...(options.headers || {}),
      },
      timeout: 30000,
      retry: 0,
    });

    await pipeline(respStream, ndjson.parse(), async function* (source) {
      for await (const slot of source) {
        const schedule = schedules[slot.schedule.reference];

        if (!schedule) {
          logger.warn(`Slot with missing schedule: ${JSON.stringify(slot)}`);
          continue;
        }

        for (const scheduleActor of schedule.actor) {
          if (!slotsByLocation[scheduleActor.reference]) {
            slotsByLocation[scheduleActor.reference] = [];
          }

          slotsByLocation[scheduleActor.reference].push(slot);
        }
      }
    });
  }
}

module.exports = Appointments;
