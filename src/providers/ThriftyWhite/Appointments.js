const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const stateSlotsResp = await got(
      "https://www.thriftywhite.com/covid19vaccine",
      {
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        timeout: 30000,
        retry: 0,
      }
    );

    const storeResponses = {};

    const stateSlots = JSON.parse(
      stateSlotsResp.body.match(
        /<script.*?\boSlt\s*=\s*(.+?);\s*<\/script>/i
      )[1]
    );
    for (const [stateCode, cities] of Object.entries(stateSlots)) {
      for (const [cityKey, city] of Object.entries(cities)) {
        for (const [cityDataKey, cityDataValue] of Object.entries(city)) {
          if (cityDataKey.match(/^d\d+/)) {
            logger.info(`Processing ${city.name} ${cityDataValue.dateF}...`);

            const lastFetched = DateTime.utc().toISO();
            const resp = await got.post(
              "https://www.thriftywhite.com/covid19vaccine",
              {
                headers: {
                  "User-Agent": "VaccineSpotter.org",
                },
                form: {
                  ajaxGetOpenSlots: "1",
                  state: stateCode,
                  city: city.name,
                  date: cityDataValue.dateF,
                },
                responseType: "json",
              }
            );

            const data = resp.body.oSlt?.[stateCode]?.[cityKey]?.[cityDataKey];
            if (!data) {
              logger.info(
                `Slot data has disappeared for city by the time slot request was made: ${city.name}, ${stateCode}`
              );
              continue;
            }

            let slotsFound = false;
            for (const [
              appointmentsDataKey,
              appointmentsDataValue,
            ] of Object.entries(
              resp.body.oSlt[stateCode][cityKey][cityDataKey]
            )) {
              if (appointmentsDataKey.match(/^s\d+/)) {
                if (!storeResponses[appointmentsDataValue.storeNumber]) {
                  storeResponses[appointmentsDataValue.storeNumber] = {
                    lastFetched,
                    bodies: [],
                    dateData: [],
                  };
                }

                storeResponses[appointmentsDataValue.storeNumber].bodies.push(
                  resp.body
                );
                storeResponses[appointmentsDataValue.storeNumber].dateData.push(
                  {
                    ...appointmentsDataValue,
                    dateF:
                      resp.body.oSlt[stateCode][cityKey][cityDataKey].dateF,
                  }
                );

                slotsFound = true;
              }
            }

            if (!slotsFound) {
              logger.error(
                `Expected to find slot data, but still missing: ${city.name}, ${stateCode}`
              );
            }

            await sleep(1000);
          }
        }
      }
    }

    const updatedProviderLocationIds = [];
    for (const [providerLocationId, data] of Object.entries(storeResponses)) {
      updatedProviderLocationIds.push(providerLocationId);

      const store = await Store.query().findOne({
        provider_id: "thrifty_white",
        provider_location_id: providerLocationId,
      });

      const patch = {
        appointments: [],
        appointments_last_fetched: data.lastFetched,
        appointments_available: false,
        appointments_raw: { date_responses: data.bodies },
      };

      for (const dateData of data.dateData) {
        for (const [key, value] of Object.entries(dateData)) {
          if (key.match(/^t\d+\w+/)) {
            patch.appointments.push({
              appointment_types: [],
              vaccine_types: normalizedVaccineTypes(value.manuf),
              type: value.manuf,
              time: DateTime.fromFormat(
                `${dateData.dateF} ${value.t1}`,
                "yyyy-LL-dd h:mm a",
                {
                  zone: store.time_zone,
                }
              ).toISO(),
            });
          }
        }
      }

      patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);

      setComputedStoreValues(patch);

      await Store.query().findById(store.id).patch(patch);
    }

    await Store.query()
      .where("provider_id", "thrifty_white")
      .whereNotIn("provider_location_id", updatedProviderLocationIds)
      .patch({
        appointments_available: false,
        appointments: [],
        appointments_last_fetched: DateTime.utc().toISO(),
      });

    logger.notice("Finished refreshing appointments for all stores.");
  }
}

module.exports = Appointments;
