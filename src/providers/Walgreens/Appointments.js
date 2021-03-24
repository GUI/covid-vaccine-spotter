const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const retry = require("p-retry");
const sleep = require("sleep-promise");
const { DateTime, Interval, Duration } = require("luxon");
const { curly } = require("node-libcurl");
const { Mutex } = require("async-mutex");
const { convertLength } = require("@turf/helpers");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const Auth = require("./Auth");
const { Store } = require("../../models/Store");

const authMutex = new Mutex();

// The Walgreens timeslot API always fetches the next 3 days of availability
// from the date specified.
const timeslotsFetchDuration = Duration.fromObject({ days: 3 });

// Walgreens always seems to check 28 days in the future for 2nd dose
// scheduling, regardless of vaccine type (Pfizer or Moderna).
const secondDoseFutureDuration = Duration.fromObject({ days: 28 });

class Appointments {
  static async refreshGridCells() {
    logger.notice("Begin refreshing appointments for all stores...");

    Appointments.locationStores = {};

    const queue = new PQueue({ concurrency: 50 });

    const gridCells = await Store.query()
      .select(
        "walgreens_grid.id",
        "centroid_postal_code",
        Store.raw(
          "st_y(walgreens_grid.centroid_land_location::geometry) AS latitude"
        ),
        Store.raw(
          "st_x(walgreens_grid.centroid_land_location::geometry) AS longitude"
        ),
        "walgreens_grid.state_code",
        "walgreens_grid.furthest_point",
        Store.raw("MIN(stores.time_zone) AS time_zone")
      )
      .where("stores.provider_id", "walgreens")
      .from(Store.raw("stores, walgreens_grid"))
      .whereRaw("st_intersects(stores.location, walgreens_grid.geom)")
      .whereRaw(
        "(appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes'))"
      )
      .groupBy("walgreens_grid.id")
      .orderByRaw("MIN(appointments_last_fetched) NULLS FIRST");
    for (const [index, gridCell] of gridCells.entries()) {
      queue.add(() =>
        Appointments.refreshGridCell(gridCell, index, gridCells.length)
      );
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static async refreshGridCell(gridCell, index, count) {
    const radiusMiles = Math.ceil(
      convertLength(gridCell.furthest_point, "meters", "miles") + 0.1
    );
    if (radiusMiles > 25) {
      // radiusMiles = 25;
    }

    logger.info(
      `Refreshing stores within ${radiusMiles} miles of ${
        gridCell.centroid_postal_code
      } (${index + 1} of ${count})...`
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

    const firstDoseRespPromise = await retry(
      async () => Appointments.fetchTimeslots(gridCell, radiusMiles, ""),
      {
        retries: 4,
        onFailedAttempt: Appointments.onFailedAttempt,
      }
    );

    const secondDoseOnlyModernaRespPromise = retry(
      async () =>
        Appointments.fetchTimeslots(
          gridCell,
          radiusMiles,
          "5fd42921195d89e656c0b028"
        ),
      {
        retries: 4,
        onFailedAttempt: Appointments.onFailedAttempt,
      }
    );

    const secondDoseOnlyPfizerRespPromise = await retry(
      async () =>
        Appointments.fetchTimeslots(
          gridCell,
          radiusMiles,
          "5fd1ab9f5fa47e056c076ff2"
        ),
      {
        retries: 4,
        onFailedAttempt: Appointments.onFailedAttempt,
      }
    );

    const firstDoseResp = await firstDoseRespPromise;
    const secondDoseOnlyModernaResp = await secondDoseOnlyModernaRespPromise;
    const secondDoseOnlyPfizerResp = await secondDoseOnlyPfizerRespPromise;
    patch.appointments_raw.first_dose = firstDoseResp.data;
    patch.appointments_raw.second_dose_only.moderna =
      secondDoseOnlyModernaResp.data;
    patch.appointments_raw.second_dose_only.pfizer =
      secondDoseOnlyPfizerResp.data;

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

    const secondDoseFetchDates = Appointments.getSecondDoseFetchDates(
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
        async () =>
          Appointments.fetchTimeslots(
            gridCell,
            radiusMiles,
            "",
            secondDoseFetchDate
          ),
        {
          retries: 4,
          onFailedAttempt: Appointments.onFailedAttempt,
        }
      );
      patch.appointments_raw.second_doses[secondDoseFetchDate] =
        secondDoseResp.data;
    }

    const storePatches = await Appointments.buildStoreSpecificPatches(patch);
    for (const [storeId, storePatch] of Object.entries(storePatches)) {
      await Store.query().findById(storeId).patch(storePatch);
    }

    await Store.query()
      .where("provider_id", "walgreens")
      .where("id", "NOT IN", Object.keys(storePatches))
      .whereRaw(
        "st_within(location::geometry, (SELECT geom FROM walgreens_grid WHERE id = ?))",
        gridCell.id
      )
      .patch(patch);
  }

  static getSecondDoseFetchDates(firstDoseDates, gridCell) {
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
  }

  static async getRespAppointments(resp) {
    const appointments = {};

    if (resp?.locations) {
      for (const location of resp.locations) {
        if (!Appointments.locationStores[location.storenumber]) {
          Appointments.locationStores[
            location.storenumber
          ] = await Store.query().findOne({
            provider_id: "walgreens",
            provider_location_id: location.storenumber,
          });
        }
        const store = Appointments.locationStores[location.storenumber];
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
  }

  static async buildStoreSpecificPatches(basePatch) {
    const secondDoseAvailableDates = {};
    for (const secondDoseResp of Object.values(
      basePatch.appointments_raw.second_doses
    )) {
      const secondDoseAppointments = await Appointments.getRespAppointments(
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

    const firstDoseAppointments = await Appointments.getRespAppointments(
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

    const secondDoseOnlyModernaAppointments = await Appointments.getRespAppointments(
      basePatch.appointments_raw.second_dose_only.moderna
    );
    logger.debug(
      `secondDoseOnlyModernaAppointments: ${JSON.stringify(
        secondDoseOnlyModernaAppointments
      )}`
    );

    const secondDoseOnlyPfizerAppointments = await Appointments.getRespAppointments(
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
          appointment_types: [],
          vaccine_types: normalizedVaccineTypes(types.join(", ")),
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
        const type = "Moderna - 2nd Dose Only";
        allAppointments[storeId].push({
          appointment_types: ["2nd_dose_only"],
          vaccine_types: normalizedVaccineTypes(type),
          time: appointment.time,
          type,
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
        const type = "Pfizer - 2nd Dose Only";
        allAppointments[storeId].push({
          appointment_types: ["2nd_dose_only"],
          vaccine_types: normalizedVaccineTypes(type),
          time: appointment.time,
          type,
        });
      }
    }

    const storePatches = {};
    for (const [storeId, appointments] of Object.entries(allAppointments)) {
      const storePatch = _.cloneDeep(basePatch);
      storePatch.appointments = _.orderBy(appointments, ["time", "type"]);

      setComputedStoreValues(storePatch);

      if (firstDoseWithSecondDoseAppointments[storeId]) {
        storePatch.appointments_available = true;
      } else {
        storePatch.appointments_available = false;
      }

      storePatches[storeId] = storePatch;
    }

    return storePatches;
  }

  static async fetchTimeslots(gridCell, radiusMiles, productId, date) {
    await sleep(_.random(1, 5));

    const auth = await authMutex.runExclusive(Auth.get);

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
        radius: radiusMiles,
        size: radiusMiles,
      }),
      timeoutMs: 15000,
      proxy: process.env.WALGREENS_TIMESLOTS_PROXY_SERVER,
      proxyUsername: process.env.WALGREENS_TIMESLOTS_PROXY_USERNAME,
      proxyPassword: process.env.WALGREENS_TIMESLOTS_PROXY_PASSWORD,
      sslVerifyPeer: false,
      acceptEncoding: "gzip",
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

    logger.debug(
      `${resp?.data?.locations?.length} locations found for productId: ${productId}, startDateTime: ${startDateTime}`
    );
    if (resp?.data?.locations && resp.data.locations.length >= 10) {
      logger.warn(
        `There may be more stores within the ${radiusMiles} mile radius than returned, since the maximum of 10 stores was returned: ${gridCell.centroid_postal_code}. Locations returned: ${resp.data.locations.length}`
      );
    }

    return resp;
  }

  static async onFailedAttempt(err) {
    logger.info(err);
    logger.info(err?.response?.statusCode);
    logger.info(err?.response?.data);
    logger.warn(`Retrying due to error: ${err}`);
    await sleep(_.random(250, 750));
    if (
      err?.response?.statusCode === 401 ||
      (err?.response?.statusCode === 403 && err.retriesLeft <= 1)
    ) {
      if (!authMutex.isLocked()) {
        await authMutex.runExclusive(Auth.refresh);
      } else {
        await authMutex.runExclusive(() => {
          logger.info("Waiting on other task to refresh auth.");
        });
      }
    }
  }
}

module.exports = Appointments;
