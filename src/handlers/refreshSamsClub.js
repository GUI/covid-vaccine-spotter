const _ = require("lodash");
const retry = require("async-retry");
const { DateTime, Settings } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const samsClubAuth = require("../samsClub/auth");
const { Store } = require("../models/Store");

Settings.defaultZoneName = "America/Denver";

module.exports.refreshSamsClub = async () => {
  const stores = await Store.query()
    .where("brand", "sams_club")
    .whereRaw("appointments_last_fetched <= (now() - interval '2 minutes')")
    .orderByRaw("appointments_last_fetched NULLS FIRST");
  let i = 0;
  for (const store of stores) {
    i += 1;
    console.info(
      `Processing ${store.name} #${store.id} (${i} of ${stores.length})...`
    );

    const patch = {
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const ageEligibilityResp = await retry(
      async () => {
        const auth = await samsClubAuth.get();
        try {
          return await got.post(
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
              },
              decompress: true,
              cookieJar: auth.cookieJar,
              responseType: "json",
              json: {
                stateCode: store.state,
                clubNumber: store.brand_id,
                imzType: "COVID",
              },
              retry: 0,
            }
          );
        } catch (err) {
          if (err.response?.body?.errors?.[0]?.code === "4002") {
            return err.response;
          }
          throw err;
        }
      },
      {
        retries: 2,
        onRetry: async (err) => {
          console.info(err);
          console.info(err?.response?.body);
          console.info(
            `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
          );
          await samsClubAuth.refresh();
        },
      }
    );

    patch.appointments_raw.ageEligibility = ageEligibilityResp.body;

    if (ageEligibilityResp.body?.errors?.[0]?.code === "4002") {
      console.info("Skipping since store does not have vaccine");
    } else {
      const slotsResp = await retry(
        async () => {
          await samsClubAuth.refresh();
          const auth = await samsClubAuth.get();
          return got(
            `https://www.samsclub.com/api/node/vivaldi/v1/slots/club/${store.brand_id}`,
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
              },
              decompress: true,
              cookieJar: auth.cookieJar,
              responseType: "json",
              retry: 0,
            }
          );
        },
        {
          retries: 2,
          onRetry: async (err) => {
            console.info(err);
            console.info(err?.response?.body);
            console.info(
              `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
            );
            await samsClubAuth.refresh();
          },
        }
      );

      patch.appointments_raw.slots = slotsResp.body;
    }

    await Store.query().findById(store.id).patch(patch);

    await sleep(50);
  }

  await Store.knex().destroy();
};

module.exports.refreshSamsClub();
