const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const retry = require("p-retry");
const sleep = require("sleep-promise");
const RandomHttpUserAgent = require("random-http-useragent");
const { DateTime } = require("luxon");
const got = require("got");
const logger = require("../logger");
const { Store } = require("../models/Store");

const Walgreens = {
  refreshGridCells: async () => {
    const queue = new PQueue({ concurrency: 10 });

    const knex = Store.knex();
    const gridCells = await knex
      .select(
        knex.raw(
          "DISTINCT ON (country_grid_55km.centroid_postal_code, country_grid_55km.id) country_grid_55km.id, country_grid_55km.centroid_postal_code, st_y(country_grid_55km.centroid_land_location::geometry) AS latitude, st_x(country_grid_55km.centroid_land_location::geometry) AS longitude, stores.time_zone"
        )
      )
      .from(knex.raw("country_grid_55km, stores"))
      .where("stores.brand", "walgreens")
      .whereRaw("st_intersects(stores.location, country_grid_55km.geom)")
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

    const availabilityResp = await retry(
      async () => Walgreens.fetchAvailability(gridCell),
      {
        retries: 2,
        onFailedAttempt: Walgreens.onFailedAttempt,
      }
    );

    patch.appointments_raw.availability = availabilityResp.body;
    if (availabilityResp.body.appointmentsAvailable === true) {
      patch.appointments_available = true;
    }

    await Store.query()
      .where("brand", "walgreens")
      .whereRaw(
        "st_within(location::geometry, (SELECT geom FROM country_grid_55km WHERE id = ?))",
        gridCell.id
      )
      .patch(patch);

    await sleep(_.random(250, 750));
  },

  fetchAvailability: async (gridCell) => {
    const tomorrow = DateTime.now().setZone(gridCell.time_zone).plus({ days: 1 });
    const agent = await RandomHttpUserAgent.get();
    return got.post(
      "https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability",
      {
        headers: {
          // 'User-Agent': 'covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)',
          "User-Agent": `${agent} covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)`,
          Referer:
            "https://www.walgreens.com/findcare/vaccination/covid-19/location-screening",
          "Accept-Language": "en-US,en;q=0.9",
        },
        json: {
          serviceId: "99",
          position: {
            latitude: gridCell.latitude,
            longitude: gridCell.longitude,
          },
          appointmentAvailability: {
            startDateTime: tomorrow.toISODate(),
          },
          radius: 25,
        },
        responseType: "json",
        timeout: 5000,
        retry: 0,
      }
    );
  },

  onFailedAttempt: (err) => {
    logger.warn(err);
    logger.warn(err?.response?.body);
    logger.warn(`Retrying due to error: ${err}`);
  },
};

module.exports.refreshWalgreens = async () => {
  await Walgreens.refreshGridCells();
};
