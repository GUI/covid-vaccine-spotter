const _ = require("lodash");
const retry = require("async-retry");
const sleep = require("sleep-promise");
const RandomHttpUserAgent = require("random-http-useragent");
const { DateTime, Settings } = require("luxon");
const got = require("got");
const getDatabase = require("../getDatabase");

Settings.defaultZoneName = "America/Denver";

module.exports.refreshWalgreens = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: "walgreens_stores",
  });

  const tomorrow = DateTime.local().plus({ days: 1 });

  let { resources } = await container.items
    .query({
      query:
        "SELECT * from c WHERE NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo",
      parameters: [
        {
          name: "@minsAgo",
          value: DateTime.utc().minus({ minutes: 2 }).toISO(),
        },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i += 1;
    console.info(
      `Processing store #${resource.id} (${i} of ${resources.length})...`
    );

    const lastFetched = DateTime.utc().toISO();

    const resp = await retry(
      async () => {
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
                latitude: parseFloat(resource.latitude),
                longitude: parseFloat(resource.longitude),
              },
              appointmentAvailability: {
                startDateTime: tomorrow.toISODate(),
              },
              radius: 1,
            },
            responseType: "json",
            timeout: 5000,
            retry: 0,
          }
        );
      },
      {
        retries: 2,
        onRetry: (err) => {
          console.info(`Retrying due to error: ${err}`);
        },
      }
    );

    await container.items.upsert({
      ...resource,
      availability: resp.body,
      lastFetched,
    });

    await sleep(1000);
  }
};

// module.exports.refreshWalgreens();
