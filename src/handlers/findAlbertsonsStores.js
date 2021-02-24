const _ = require("lodash");
const retry = require("p-retry");
const sleep = require("sleep-promise");
const got = require("got");
const logger = require("../logger");
const albertsonsAuth = require("../albertsons/auth");
const { Store } = require("../models/Store");
const { State } = require("../models/State");

module.exports.findAlbertsonsStores = async () => {
  const states = await State.query().select("code", "name");
  const stateCodeByName = {};
  for (const state of states) {
    stateCodeByName[state.name] = state.code;
  }

  let batch = [];

  const storesResp = await got(
    "https://www.mhealthappointments.com/views/assets/js/vaccinationRandalls.json",
    {
      searchParams: {
        v: _.random(0, 999999999999),
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      responseType: "json",
      retry: 0,
    }
  );
  for (const store of storesResp.body) {
    const data = {
      brand: "albertsons",
      brand_id: store.id,
      location: `point(${store.long} ${store.lat})`,
      metadata_raw: { vaccinationRandalls: store },
      // metadata_raw: Store.raw("(metadata_raw || ?::jsonb)", JSON.stringify({ vaccinationRandalls: store }))
    };
    const state =
      stateCodeByName[
        store.region
          .replace(/_-_.*/, " ")
          .replace(/_/g, " ")
          .replace(/\s+$/, "")
      ];
    if (state) {
      data.state = state;
    }
    batch.push(data);

    if (batch.length >= 1000) {
      await Store.query()
        .insert(batch)
        .onConflict(["brand", "brand_id"])
        .merge();
      batch = [];
    }
  }

  if (batch.length >= 0) {
    await Store.query().insert(batch).onConflict(["brand", "brand_id"]).merge();
    batch = [];
  }

  await sleep(1000);

  const coachUrls = await Store.query()
    .select(
      Store.raw(
        "metadata_raw->'vaccinationRandalls'->>'coach_url' AS coach_url, MIN(brand_id) AS brand_id"
      )
    )
    .where("brand", "albertsons")
    .whereRaw("metadata_raw->'coachUrlRedirect'->'params'->'p' IS NULL")
    .groupBy("coach_url");
  for (const coachUrl of coachUrls) {
    const coachResp = await got(coachUrl.coach_url, {
      searchParams: {
        clientId: coachUrl.brand_id,
        inStore: "yes",
        attestation: "true",
        apptType: "COVID_VACCINE_DOSE1_APPT",
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
      },
      followRedirect: false,
      retry: 0,
    });
    const redirect = coachResp.headers.location;
    const url = new URL(redirect);
    const hashUrl = new URL(url.hash.replace(/^#/, ""), redirect);
    const redirectParams = {};
    for (const [key, value] of hashUrl.searchParams) {
      redirectParams[key] = value;
    }

    await Store.query()
      .where("brand", "albertsons")
      .whereRaw(
        "metadata_raw->'vaccinationRandalls'->>'coach_url' = ?",
        coachUrl.coach_url
      )
      .update({
        metadata_raw: Store.raw(
          "(metadata_raw || ?::jsonb)",
          JSON.stringify({
            coachUrlRedirect: {
              url: redirect,
              params: redirectParams,
            },
          })
        ),
      });

    await sleep(1000);
  }

  const authParams = await Store.query()
    .select(
      Store.raw(
        "metadata_raw->'coachUrlRedirect'->'params'->>'p' AS auth_param, jsonb_agg(brand_id) AS brand_ids"
      )
    )
    .where("brand", "albertsons")
    .groupBy("auth_param")
    .orderBy("auth_param");
  for (const authParam of authParams) {
    const brandIdChunks = _.chunk(authParam.brand_ids, 200);
    for (const chunk of brandIdChunks) {
      logger.info(`Checking if stores carry vaccines: ${chunk.join(",")}`);
      const locationsResp = await retry(
        async () => {
          const auth = await albertsonsAuth.get(authParam.auth_param);
          return got(
            "https://kordinator.mhealthcoach.net/loadLocationsForClientAndApptType.do",
            {
              searchParams: {
                _r: _.random(0, 999999999999),
                apptKey: "COVID_VACCINE_DOSE1_APPT",
                clientIds: chunk.join(","),
                csrfKey: auth.body.csrfKey,
                externalClientId: "1610133367915",
                instore: "yes",
              },
              headers: {
                "User-Agent":
                  "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
              },
              cookieJar: auth.cookieJar,
              responseType: "json",
              retry: 0,
            }
          );
        },
        {
          retries: 2,
          onFailedAttempt: async (err) => {
            logger.warn(err);
            logger.warn(err?.response?.body);
            logger.warn(
              `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
            );
            await albertsonsAuth.refresh(authParam.auth_param);
          },
        }
      );

      for (const store of locationsResp.body) {
        const addressParts = store.name.match(
          /^(?:.*? - )?(.+), (.+?), (.+?)?, (\d+)$/
        );
        if (
          !addressParts[3] &&
          (addressParts[4] === "94121" || addressParts[4] === "94122")
        ) {
          addressParts[3] = "CA";
        }
        const patch = {
          name: store.clientName,
          address: addressParts[1],
          city: addressParts[2],
          state: addressParts[3],
          postal_code: addressParts[4],
          time_zone: store.timezone,
          carries_vaccine: true,
          metadata_raw: Store.raw(
            "(metadata_raw || ?::jsonb)",
            JSON.stringify({
              loadLocationsForClientAndApptType: store,
            })
          ),
        };

        await Store.query()
          .findOne({
            brand: "albertsons",
            brand_id: store.clientId,
          })
          .patch(patch);
      }

      await sleep(1000);
    }
  }

  await Store.knex().destroy();
};

module.exports.findAlbertsonsStores();
