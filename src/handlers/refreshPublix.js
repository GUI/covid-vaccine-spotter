const { default: PQueue } = require("p-queue");
const got = require("got");
const { capitalCase } = require("capital-case");
const logger = require("../logger");
const { Store } = require("../models/Store");

const HEADERS = {
  "User-Agent": "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)"
};

function appointmentAvailabilityFromStatusString(s) {
  if (s.startsWith('Fully Booked')) {
    return false;
  } else if (s.startsWith('None Available')) {
    return false
  } else if (s.startsWith('Less than 1%')) {
    return true;
  } else if (s.match(/^\d+\%/)) {
    return true;
  } else {
    logger.warn(`Unrecognized availability string from Publix: ${s}`);
    return false;
  }
}

function patchFromLine(l, state, lastFetched) {
  var pieces = l.split('|');
  var county = pieces[0];
  var status = pieces[1];

  return {
    brand: "publix",
    brand_id: `${state}-${county}`,
    name: `${county}, ${capitalCase(state)}`,
    county_name: county,
    state: state,
    carries_vaccine: true,
    appointments: [],
    appointments_last_fetched: lastFetched,
    appointments_available: appointmentAvailabilityFromStatusString(status),
    appointments_raw: status,
  };
}

const Publix = {
  refreshStores: async () => {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 5 });
    const lastFetched = new Date().toISOString();
    const states = [
      'florida',
      'georgia',
      'south-carolina'
    ];

    states.forEach((state) => {
      queue.add(() => {
        return got(
          `https://www.publix.com/covid-vaccine/${state}/${state}-county-status.txt`,
          {
            headers: HEADERS,
            encoding: 'utf16le',
            timeout: 30000,
            retry: 0,
          }
        )
        .then((res) => {
          var lines = res.body.split(/\r?\n/);
          lines.forEach((l) => {
            if (!l) return; // skip blank lines (e.g. at end)
            var patch = patchFromLine(l, state, lastFetched);
            queue.add(() =>
              Store.query().insert(patch).onConflict(["brand", "brand_id"]).merge()
            );
          });
        })
      });
    });

    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  },
};

module.exports.refreshPublix = async () => {
  await Publix.refreshStores();
};
