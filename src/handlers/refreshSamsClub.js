const _ = require("lodash");
const { DateTime, Settings } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const samsClubAuth = require("../samsClub/auth");
const getDatabase = require("../getDatabase");

Settings.defaultZoneName = "America/Denver";

module.exports.refreshSamsClub = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: "sams_club_stores",
  });

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
      `Processing ${resource.displayName} #${resource.id} (${i} of ${resources.length})...`
    );

    /*
    if(!resource.servicesMap || !resource.servicesMap.COVID_IMMUNIZATIONS || !resource.servicesMap.COVID_IMMUNIZATIONS.active) {
      console.info(`  Skipping ${resource.displayName} #${resource.id} since it doesn't currently support COVID vaccines.`);
      continue;
    }
    */
    console.info(resource);

    const lastFetched = DateTime.utc().toISO();

    const auth = await samsClubAuth.get();
    let code;
    try {
      const resp = await got.post(
        "https://www.samsclub.com/api/node/vivaldi/v1/pharmacy/rules/ageEligibility",
        {
          headers: {
            // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
            authority: "www.samsclub.com",
            "sec-ch-ua": '" Not A;Brand";v="99", "Chromium";v="90"',
            accept: "application/json, text/plain, */*",
            "sec-ch-ua-mobile": "?0",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4392.0 Safari/537.36",
            "content-type": "application/json",
            origin: "https://www.samsclub.com",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            referer:
              "https://www.samsclub.com/pharmacy/immunization/form?imzType=covid&xid=login-success",
            "accept-language": "en-US,en;q=0.9",
            // "accept": "application/json, text/plain, */*",
            // "accept-language": "en-US,en;q=0.9",
            // "cache-control": "no-cache",
            // "content-type": "application/json",
            // "pragma": "no-cache",
            // "sec-ch-ua": "\"Chromium\";v=\"88\", \"Google Chrome\";v=\"88\", \";Not A Brand\";v=\"99\"",
            // "sec-ch-ua-mobile": "?0",
            // "sec-fetch-dest": "empty",
            // "sec-fetch-mode": "cors",
            // "sec-fetch-site": "same-origin",
          },
          decompress: true,
          cookieJar: auth.cookieJar,
          responseType: "json",
          json: {
            stateCode: resource.address.state,
            clubNumber: resource.id,
            imzType: "COVID",
          },
          retry: 0,
        }
      );
      console.info(resp.body);
    } catch (err) {
      console.info(err);
      // console.info(err.response);
      console.info(err.response.body);
      code = err.response.body.errors[0].code;
    }

    if (code === "4002") {
      console.info("Skipping since store does not have vaccine");
      continue;
    }

    try {
      const resp = await got(
        `https://www.samsclub.com/api/node/vivaldi/v1/slots/club/${resource.id}`,
        {
          searchParams: {
            membershipType: "BASE",
            numOfDays: "6",
            serviceType: "IMMUNIZATION",
          },
          headers: {
            // 'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
            authority: "www.samsclub.com",
            "sec-ch-ua": '" Not A;Brand";v="99", "Chromium";v="90"',
            accept: "application/json, text/plain, */*",
            "sec-ch-ua-mobile": "?0",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4392.0 Safari/537.36",
            "content-type": "application/json",
            origin: "https://www.samsclub.com",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            referer:
              "https://www.samsclub.com/pharmacy/immunization/form?imzType=covid&xid=login-success",
            "accept-language": "en-US,en;q=0.9",
            // "accept": "application/json, text/plain, */*",
            // "accept-language": "en-US,en;q=0.9",
            // "cache-control": "no-cache",
            // "content-type": "application/json",
            // "pragma": "no-cache",
            // "sec-ch-ua": "\"Chromium\";v=\"88\", \"Google Chrome\";v=\"88\", \";Not A Brand\";v=\"99\"",
            // "sec-ch-ua-mobile": "?0",
            // "sec-fetch-dest": "empty",
            // "sec-fetch-mode": "cors",
            // "sec-fetch-site": "same-origin",
          },
          decompress: true,
          cookieJar: auth.cookieJar,
          responseType: "json",
          retry: 0,
        }
      );
      console.info(resp.body);
    } catch (err) {
      console.info(err);
      // console.info(err.response);
      console.info(err.response.body);
    }

    /*
    const auth = await samsClubAuth.get();
    const resp = await retry(async () => {
      const auth = await samsClubAuth.get();
      return await got.post(`https://www.walmart.com/pharmacy/v2/clinical-services/time-slots/${auth.body.payload.cid}`, {
        headers: {
          'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
        },
        cookieJar: auth.cookieJar,
        responseType: 'json',
        json: {
          startDate: DateTime.local().toFormat('LLddyyyy'),
          endDate: DateTime.local().plus({ days: 6 }).toFormat('LLddyyyy'),
          imzStoreNumber: {
            USStoreId: parseInt(resource.id, 10),
          },
        },
        retry: 0,
      });
    }, {
      retries: 2,
      onRetry: async (err) => {
        console.info(`Error fetching data (${err.response.statusCode}), attempting to refresh auth and then retry.`);
        await samsClubAuth.refresh();
      },
    });

    await container.items.upsert({
      ...resource,
      timeSlots: resp.body,
      lastFetched,
    });
    */

    await sleep(1000);
  }
};

module.exports.refreshSamsClub();
