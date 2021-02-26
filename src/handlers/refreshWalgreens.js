const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const retry = require("p-retry");
const sleep = require("sleep-promise");
// const RandomHttpUserAgent = require("random-http-useragent");
const { DateTime } = require("luxon");
const got = require("got");
const { Mutex } = require("async-mutex");
const logger = require("../logger");
const walgreensAuth = require("../walgreens/auth");
const { Store } = require("../models/Store");

const authMutex = new Mutex();

const Walgreens = {
  refreshGridCells: async () => {
    const queue = new PQueue({ concurrency: 10 });

    const knex = Store.knex();
    const gridCells = await knex
      .select(
        knex.raw(
          "DISTINCT ON (state_grid_55km.centroid_postal_code, state_grid_55km.id) state_grid_55km.id, state_grid_55km.centroid_postal_code, st_y(state_grid_55km.centroid_land_location::geometry) AS latitude, st_x(state_grid_55km.centroid_land_location::geometry) AS longitude, stores.time_zone"
        )
      )
      .from(knex.raw("state_grid_55km, stores"))
      .where("stores.brand", "walgreens")
      .whereRaw("st_intersects(stores.location, state_grid_55km.geom)")
      .orderBy("centroid_postal_code");
    for (const [index, gridCell] of _.shuffle(gridCells).entries()) {
      queue.add(() =>
        Walgreens.refreshGridCell(gridCell, index, gridCells.length)
      );
    }
    await queue.onIdle();
  },

  refreshGridCell: async (gridCell, index, count) => {
    logger.info(
      `Refreshing stores within 25 miles of ${gridCell.centroid_postal_code} (${
        index + 1
      } of ${count})...`
    );

    await sleep(_.random(250, 750));

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const bothDosesResp = await retry(
      async () => Walgreens.fetchTimeslots(gridCell, ""),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );

    await sleep(_.random(250, 750));

    const secondDoseModernaResp = await retry(
      async () =>
        Walgreens.fetchTimeslots(gridCell, "5fd42921195d89e656c0b028"),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );

    await sleep(_.random(250, 750));

    const secondDosePfizerResp = await retry(
      async () =>
        Walgreens.fetchTimeslots(gridCell, "5fd1ab9f5fa47e056c076ff2"),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );

    patch.appointments_raw.both_doses = bothDosesResp.body;
    patch.appointments_raw.second_dose_moderna = secondDoseModernaResp.body;
    patch.appointments_raw.second_dose_pfizer = secondDosePfizerResp.body;

    const storePatches = await Walgreens.buildStoreSpecificPatches(patch);
    // console.info('storePatches: ', storePatches);

    for (const [storeId, storePatch] of Object.entries(storePatches)) {
      // console.info('storePatch: ', JSON.stringify(storePatch, null, '  '));
      await Store.query().findById(storeId).patch(storePatch);
    }

    await Store.query()
      .where("brand", "walgreens")
      .where("id", "NOT IN", Object.keys(storePatches))
      .whereRaw(
        "st_within(location::geometry, (SELECT geom FROM state_grid_55km WHERE id = ?))",
        gridCell.id
      )
      .patch(patch);

    await sleep(_.random(250, 750));
  },

  buildStoreSpecificPatches: async (basePatch) => {
    const locationStores = {};
    const storePatches = {};
    for (const [doseType, timeslots] of Object.entries(
      basePatch.appointments_raw
    )) {
      // console.info('doseKey: ', doseKey);
      // console.info('timeslots: ', timeslots);
      if (timeslots?.locations) {
        for (const location of timeslots.locations) {
          if (!locationStores[location.storenumber]) {
            locationStores[location.storenumber] = await Store.query().findOne({
              brand: "walgreens",
              brand_id: location.storenumber,
            });
          }
          const store = locationStores[location.storenumber];

          if (!storePatches[store.id]) {
            storePatches[store.id] = _.cloneDeep(basePatch);
          }
          const storePatch = storePatches[store.id];

          const appointments = location.appointmentAvailability.reduce(
            (appts, day) =>
              appts.concat(
                day.slots.map((slot) => ({
                  type: doseType,
                  time: DateTime.fromFormat(
                    `${day.date} ${slot}`,
                    "yyyy-LL-dd hh:mm a",
                    { zone: store.time_zone }
                  ).toISO(),
                }))
              ),
            []
          );
          storePatch.appointments = storePatch.appointments.concat(
            appointments
          );
        }
      }
    }

    for (const storePatch of Object.values(storePatches)) {
      storePatch.appointments = _.orderBy(storePatch.appointments, [
        "time",
        "type",
      ]);

      if (storePatch.appointments.length > 0) {
        storePatch.appointments_available = true;
      }
    }

    return storePatches;
  },

  fetchTimeslots: async (gridCell, productId) => {
    const auth = await authMutex.runExclusive(walgreensAuth.get);
    const tomorrow = DateTime.now()
      .setZone(gridCell.time_zone)
      .plus({ days: 1 });
    // const agent = await RandomHttpUserAgent.get();
    try {
      return await got.post(
        "https://www.walgreens.com/hcschedulersvc/svc/v2/immunizationLocations/timeslots",
        {
          headers: {
            "User-Agent":
              "covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)",
            // "User-Agent": `${agent} covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)`,
            Referer:
              "https://www.walgreens.com/findcare/vaccination/covid-19/appointment/next-available",
            "Accept-Language": "en-US,en;q=0.9",
          },
          json: {
            serviceId: "99",
            position: {
              latitude: gridCell.latitude,
              longitude: gridCell.longitude,
            },
            state: gridCell.state_code,
            vaccine: {
              productId,
            },
            appointmentAvailability: {
              startDateTime: tomorrow.toISODate(),
            },
            radius: 25,
            size: 25,
          },
          cookieJar: auth.cookieJar,
          responseType: "json",
          timeout: 15000,
          retry: 0,
        }
      );
    } catch (err) {
      if (
        err?.response?.statusCode === 404 &&
        err?.response?.body?.error?.[0]?.code === "FC_904_NoData" &&
        err?.response?.body?.error?.[0]?.message === "Insufficient inventory."
      ) {
        return err.response;
      }
      throw err;
    }
  },

  onFailedAttempt: async (err) => {
    logger.warn(err);
    logger.warn(err?.response?.body);
    logger.warn(`Retrying due to error: ${err}`);
    await sleep(5000);
    /*
    if (!authMutex.isLocked()) {
      await authMutex.runExclusive(walgreensAuth.refresh);
    }
    */
  },
};

module.exports.refreshWalgreens = async () => {
  await Walgreens.refreshGridCells();
};
