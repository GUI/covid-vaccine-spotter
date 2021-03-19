const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const retry = require("p-retry");
const sleep = require("sleep-promise");
const { DateTime, Interval, Duration } = require("luxon");
const { curly } = require("node-libcurl");
const { Mutex } = require("async-mutex");
const logger = require("../logger");
const walgreensAuth = require("../walgreens/auth");
const { Store } = require("../models/Store");

const authMutex = new Mutex();

// The Walgreens timeslot API always fetches the next 3 days of availability
// from the date specified.
const timeslotsFetchDuration = Duration.fromObject({ days: 3 });

// Walgreens always seems to check 28 days in the future for 2nd dose
// scheduling, regardless of vaccine type (Pfizer or Moderna).
const secondDoseFutureDuration = Duration.fromObject({ days: 28 });

const Walgreens = {
  refreshGridCells: async () => {
    logger.notice("Begin refreshing appointments for all stores...");

    Walgreens.locationStores = {};

    const queue = new PQueue({ concurrency: 15 });

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

    logger.notice("Finished refreshing appointments for all stores.");
  },

  refreshGridCell: async (gridCell, index, count) => {
    logger.info(
      `Refreshing stores within 25 miles of ${gridCell.centroid_postal_code} (${
        index + 1
      } of ${count})...`
    );

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {
        second_doses: {},
        second_dose_only: {},
      },
    };

    const firstDoseResp = await retry(
      async () => Walgreens.fetchTimeslots(gridCell, ""),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );
    patch.appointments_raw.first_dose = firstDoseResp.data;

    let firstDoseDates = [];
    if (firstDoseResp.data?.locations) {
      for (const location of firstDoseResp.data.locations) {
        for (const availability of location.appointmentAvailability) {
          firstDoseDates.push(availability.date);
        }
      }
    }
    firstDoseDates = _.uniq(firstDoseDates, gridCell);
    logger.debug(`First dose dates: ${JSON.stringify(firstDoseDates)}`);

    const secondDoseFetchDates = Walgreens.getSecondDoseFetchDates(
      firstDoseDates,
      gridCell
    );
    logger.debug(
      `Potential second dose dates to query: ${JSON.stringify(
        secondDoseFetchDates
      )}`
    );
    for (const secondDoseFetchDate of secondDoseFetchDates) {
      const secondDoseResp = await retry(
        async () => Walgreens.fetchTimeslots(gridCell, "", secondDoseFetchDate),
        {
          retries: 4,
          onFailedAttempt: Walgreens.onFailedAttempt,
        }
      );
      patch.appointments_raw.second_doses[secondDoseFetchDate] =
        secondDoseResp.data;
    }

    const secondDoseOnlyModernaResp = await retry(
      async () =>
        Walgreens.fetchTimeslots(gridCell, "5fd42921195d89e656c0b028"),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );
    patch.appointments_raw.second_dose_only.moderna =
      secondDoseOnlyModernaResp.data;

    const secondDoseOnlyPfizerResp = await retry(
      async () =>
        Walgreens.fetchTimeslots(gridCell, "5fd1ab9f5fa47e056c076ff2"),
      {
        retries: 4,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );
    patch.appointments_raw.second_dose_only.pfizer =
      secondDoseOnlyPfizerResp.data;

    const storePatches = await Walgreens.buildStoreSpecificPatches(patch);
    for (const [storeId, storePatch] of Object.entries(storePatches)) {
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
  },

  getSecondDoseFetchDates: (firstDoseDates, gridCell) => {
    // Based on the days when 1st appointments are available, determine what
    // date ranges in the future we need to check for 2nd doses on. Walgreens
    // currently always checks 28 days from the initially selected 1st dose
    // date (and the API always returns 3 days of potential availability).
    const secondDoseDateIntervals = firstDoseDates.map((date) => {
      const start = DateTime.fromFormat(date, "yyyy-LL-dd", {
        zone: gridCell.time_zone,
      }).plus(secondDoseFutureDuration);
      const end = start.plus(timeslotsFetchDuration);
      return Interval.fromDateTimes(start, end);
    });

    // Based on the future date ranges we need for 2nd doses, determine the
    // minimal dates we need to query, accounting for potential overlap in
    // dates. For example, if we need to check the 3 day ranges on 4/8, 4/9,
    // and 4/10, we only actually need to query on the 4/8 and 4/10 dates,
    // since the 4/9 data would be captured by the other queries (since each
    // query includes 3 days of potential data).
    //
    // Start by merging all of the date ranges we need to query into a single
    // range.
    const secondDoseFetchDates = [];
    const secondDoseMergedIntervals = Interval.merge(secondDoseDateIntervals);
    for (const mergedInterval of secondDoseMergedIntervals) {
      // Split the merged date range by the 3 day duration each query would
      // fetch.
      const splitIntervals = mergedInterval.splitBy(timeslotsFetchDuration);
      for (const splitInterval of splitIntervals) {
        const fetchEndDate = splitInterval.end;

        // For the query start date used in the fetch, always use 3 days prior
        // to the end this may not match splitInterval.start if the
        // spitInterval is a shorter 1 or 2 day period). This ensures that we
        // don't accidentally query dates outside of the range than what
        // Walgreens would be querying for.
        let fetchStartDate = fetchEndDate.minus(timeslotsFetchDuration);

        // Make sure we haven't gone beyond the actual start.
        if (fetchStartDate < mergedInterval.start) {
          fetchStartDate = mergedInterval.start;
        }

        secondDoseFetchDates.push(fetchStartDate.toISODate());
      }
    }

    return secondDoseFetchDates;
  },

  getRespAppointments: async (resp) => {
    const appointments = {};

    if (resp?.locations) {
      for (const location of resp.locations) {
        if (!Walgreens.locationStores[location.storenumber]) {
          Walgreens.locationStores[
            location.storenumber
          ] = await Store.query().findOne({
            brand: "walgreens",
            brand_id: location.storenumber,
          });
        }
        const store = Walgreens.locationStores[location.storenumber];
        if (!store) {
          logger.warn(
            `Store in database not found for store number #${location.storenumber}, skipping`
          );
          continue;
        }

        appointments[store.id] = location.appointmentAvailability.reduce(
          (appts, day) =>
            appts.concat(
              day.slots.map((slot) => ({
                time: DateTime.fromFormat(
                  `${day.date} ${slot}`,
                  "yyyy-LL-dd hh:mm a",
                  { zone: store.time_zone }
                ).toISO(),
              }))
            ),
          []
        );
      }
    }

    return appointments;
  },

  buildStoreSpecificPatches: async (basePatch) => {
    const secondDoseAvailableDates = {};
    for (const secondDoseResp of Object.values(
      basePatch.appointments_raw.second_doses
    )) {
      const secondDoseAppointments = await Walgreens.getRespAppointments(
        secondDoseResp
      );
      for (const [storeId, appointments] of Object.entries(
        secondDoseAppointments
      )) {
        if (!secondDoseAvailableDates[storeId]) {
          secondDoseAvailableDates[storeId] = {};
        }

        for (const appointment of appointments) {
          const appointmentDate = DateTime.fromISO(
            appointment.time
          ).toISODate();
          secondDoseAvailableDates[storeId][appointmentDate] = true;
        }
      }
    }
    logger.debug(
      `secondDoseAvailableDates: ${JSON.stringify(secondDoseAvailableDates)}`
    );

    const firstDoseAppointments = await Walgreens.getRespAppointments(
      basePatch.appointments_raw.first_dose
    );
    logger.debug(
      `firstDoseAppointments: ${JSON.stringify(firstDoseAppointments)}`
    );
    const firstDoseWithSecondDoseAppointments = {};
    for (const [storeId, appointments] of Object.entries(
      firstDoseAppointments
    )) {
      for (const appointment of appointments) {
        let appointmentHasSecondDose = false;

        const firstDoseTime = DateTime.fromISO(appointment.time, {
          setZone: true,
        });
        const secondDoseStartTime = firstDoseTime.plus(
          secondDoseFutureDuration
        );
        const secondDoseEndTime = secondDoseStartTime.plus(
          timeslotsFetchDuration
        );
        let secondDoseTime = secondDoseStartTime;
        while (secondDoseTime <= secondDoseEndTime) {
          if (
            secondDoseAvailableDates?.[storeId]?.[secondDoseTime.toISODate()]
          ) {
            appointmentHasSecondDose = true;
            break;
          }

          secondDoseTime = secondDoseTime.plus({ days: 1 });
        }

        if (appointmentHasSecondDose) {
          logger.debug(
            `First dose with bookable second dose: ${appointment.time}`
          );
          if (!firstDoseWithSecondDoseAppointments[storeId]) {
            firstDoseWithSecondDoseAppointments[storeId] = [];
          }

          firstDoseWithSecondDoseAppointments[storeId].push(appointment);
        } else {
          logger.debug(
            `Discarding first dose without bookable second dose: ${appointment.time}`
          );
        }
      }
    }

    const secondDoseOnlyModernaAppointments = await Walgreens.getRespAppointments(
      basePatch.appointments_raw.second_dose_only.moderna
    );
    logger.debug(
      `secondDoseOnlyModernaAppointments: ${JSON.stringify(
        secondDoseOnlyModernaAppointments
      )}`
    );

    const secondDoseOnlyPfizerAppointments = await Walgreens.getRespAppointments(
      basePatch.appointments_raw.second_dose_only.pfizer
    );
    logger.debug(
      `secondDoseOnlyPfizerAppointments: ${JSON.stringify(
        secondDoseOnlyPfizerAppointments
      )}`
    );

    const allAppointments = {};
    for (const [storeId, appointments] of Object.entries(
      firstDoseWithSecondDoseAppointments
    )) {
      if (!allAppointments[storeId]) {
        allAppointments[storeId] = [];
      }

      for (const appointment of appointments) {
        const types = [];
        if (
          secondDoseOnlyModernaAppointments[storeId] &&
          secondDoseOnlyModernaAppointments[storeId].some(
            (a) => a.time === appointment.time
          )
        ) {
          types.push("Moderna");
        }
        if (
          secondDoseOnlyPfizerAppointments[storeId] &&
          secondDoseOnlyPfizerAppointments[storeId].some(
            (a) => a.time === appointment.time
          )
        ) {
          types.push("Pfizer");
        }

        allAppointments[storeId].push({
          time: appointment.time,
          type: types.length > 0 ? types.join(", ") : null,
        });
      }
    }

    for (const [storeId, appointments] of Object.entries(
      secondDoseOnlyModernaAppointments
    )) {
      if (!allAppointments[storeId]) {
        allAppointments[storeId] = [];
      }

      for (const appointment of appointments) {
        allAppointments[storeId].push({
          time: appointment.time,
          type: "Moderna - 2nd Dose Only",
        });
      }
    }

    for (const [storeId, appointments] of Object.entries(
      secondDoseOnlyPfizerAppointments
    )) {
      if (!allAppointments[storeId]) {
        allAppointments[storeId] = [];
      }

      for (const appointment of appointments) {
        allAppointments[storeId].push({
          time: appointment.time,
          type: "Pfizer - 2nd Dose Only",
        });
      }
    }

    const storePatches = {};
    for (const [storeId, appointments] of Object.entries(allAppointments)) {
      const storePatch = _.cloneDeep(basePatch);
      storePatch.appointments = _.orderBy(appointments, ["time", "type"]);

      if (firstDoseWithSecondDoseAppointments[storeId]) {
        storePatch.appointments_available = true;
      }

      storePatches[storeId] = storePatch;
    }

    return storePatches;
  },

  fetchTimeslots: async (gridCell, productId, date) => {
    await sleep(_.random(250, 750));

    const auth = await authMutex.runExclusive(walgreensAuth.get);

    let startDateTime = date;
    if (!startDateTime) {
      const tomorrow = DateTime.now()
        .setZone(gridCell.time_zone)
        .plus({ days: 1 });
      startDateTime = tomorrow.toISODate();
    }

    logger.debug(
      `Fetching timeslots for productId: ${productId}, startDateTime: ${startDateTime}`
    );
    const url =
      "https://www.walgreens.com/hcschedulersvc/svc/v2/immunizationLocations/timeslots";
    const resp = await curly.post(url, {
      httpHeader: [
        "Accept-Language: en-US,en;q=0.9",
        "Accept: application/json, text/plain, */*",
        "Authority: www.walgreens.com",
        "Cache-Control: no-cache",
        "Content-Type: application/json; charset=UTF-8",
        "Origin: https://www.walgreens.com",
        "Pragma: no-cache",
        "Referer: https://www.walgreens.com/findcare/vaccination/covid-19/appointment/next-available",
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0",
        `Cookie: ${await auth.cookieJar.getCookieString(url)}`,
      ],
      postFields: JSON.stringify({
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
          startDateTime,
        },
        radius: 25,
        size: 25,
      }),
      timeoutMs: 15000,
      proxy: process.env.WALGREENS_TIMESLOTS_PROXY_SERVER,
      proxyUsername: process.env.WALGREENS_TIMESLOTS_PROXY_USERNAME,
      proxyPassword: process.env.WALGREENS_TIMESLOTS_PROXY_PASSWORD,
      sslVerifyPeer: false,
    });

    if (
      resp.statusCode === 404 &&
      resp.data?.error?.[0]?.code === "FC_904_NoData" &&
      (resp.data?.error?.[0]?.message === "Insufficient inventory." ||
        resp.data?.error?.[0]?.message === "No participating store.")
    ) {
      return resp;
    }

    if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
      const err = new Error(
        `Request failed with status code ${resp.statusCode}`
      );
      err.response = resp;
      throw err;
    }

    return resp;
  },

  onFailedAttempt: async (err) => {
    logger.warn(err);
    logger.warn(err?.response?.statusCode);
    logger.warn(err?.response?.data);
    logger.warn(`Retrying due to error: ${err}`);
    await sleep(5000);
    if (err?.response?.statusCode === 401) {
      if (!authMutex.isLocked()) {
        await authMutex.runExclusive(walgreensAuth.refresh);
      }
    }
  },
};

module.exports.refreshWalgreens = async () => {
  await Walgreens.refreshGridCells();
};
