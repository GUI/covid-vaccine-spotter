const execa = require("execa");
const fs = require("fs").promises;
const stringify = require("json-stable-stringify");
const path = require("path");
const logger = require("../logger");
const { Store } = require("../models/Store");
const { State } = require("../models/State");

async function writeStoreData(dataPath, brand, conditions = {}) {
  logger.info(`Writing data for ${brand}`);
  const storeSelect = Store.knex().raw(`
    state,
    json_agg(
      json_build_object(
        'id', id,
        'brand', brand,
        'brand_id', brand_id,
        'name', name,
        'address', address,
        'city', city,
        'state', state,
        'postal_code', postal_code,
        'time_zone', time_zone,
        'latitude', st_y(location::geometry),
        'longitude', st_x(location::geometry),
        'carries_vaccine', carries_vaccine,
        'appointments', appointments,
        'appointments_available', appointments_available,
        'appointments_last_fetched', appointments_last_fetched
      )
      ORDER BY id
    ) AS state_data
  `);

  const states = await Store.knex()
    .select(storeSelect)
    .from("stores")
    .where("brand", brand)
    .where(conditions)
    .whereNotNull("state")
    .groupBy("state")
    .orderBy("state");
  for (const state of states) {
    await fs.writeFile(
      `${dataPath}/stores/${state.state}/${brand}.json`,
      stringify(state.state_data, { space: "  " })
    );
  }

  logger.info(`Finished writing data for ${brand}`);
}

async function runShell(...args) {
  const cmd = execa(...args);
  logger.info(cmd.spawnargs.join(" "));
  await cmd;
  logger.info(`Shell command complete (${cmd.spawnargs.join(" ")})`);
  return cmd;
}

module.exports.refreshWebsite = async () => {
  logger.notice("Begin refreshing website...");

  const dataPath = path.resolve("site/api/v0");
  await runShell("rm", ["-rf", "_site_build", dataPath]);
  await runShell("mkdir", ["-p", dataPath]);

  const states = await State.knex().raw(`
    SELECT
      states.code,
      states.name,
      COUNT(stores.id) AS store_count,
      COUNT(DISTINCT stores.provider_brand_id) AS provider_brand_count,
      MAX(stores.appointments_last_fetched) AS appointments_last_fetched,
      (
        SELECT
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'key', p.key,
            'name', p.name,
            'provider_id', p.provider_id,
            'url', p.url,
            'location_count', p.location_count,
            'appointments_last_fetched', p.appointments_last_fetched
          )
        )
        FROM (
          SELECT
            provider_brands.*,
            COUNT(stores.id) AS location_count,
            MAX(appointments_last_fetched) AS appointments_last_fetched
          FROM stores
          LEFT JOIN provider_brands ON stores.provider_brand_id = provider_brands.id
          WHERE
            stores.state = states.code
            AND stores.active = true
          GROUP BY provider_brands.id
          ORDER BY provider_brands.name
        ) AS p
      ) AS provider_brands
    FROM states
    LEFT JOIN stores ON stores.state = states.code AND stores.active = true
    GROUP BY states.id
    ORDER BY states.name
  `);
  await fs.writeFile(
    `${dataPath}/states.json`,
    JSON.stringify(states.rows)
  );
  for (const state of states.rows) {
    await runShell("mkdir", ["-p", `${dataPath}/stores/${state.code}`]);
  }

  const statesData = await State.knex().raw(`
    SELECT
      states.code,
      jsonb_build_object(
        'type', 'FeatureCollection',
        'metadata', jsonb_build_object(
          'code', states.code,
          'name', states.name,
          'store_count', COUNT(stores.id),
          'provider_brand_count', COUNT(DISTINCT stores.provider_brand_id),
          'appointments_last_fetched', MAX(stores.appointments_last_fetched),
          'provider_brands', (
            SELECT
            jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'key', p.key,
                'name', p.name,
                'provider_id', p.provider_id,
                'url', p.url,
                'location_count', p.location_count,
                'appointments_last_fetched', p.appointments_last_fetched
              )
            )
            FROM (
              SELECT
                provider_brands.*,
                COUNT(stores.id) AS location_count,
                MAX(appointments_last_fetched) AS appointments_last_fetched
              FROM stores
              LEFT JOIN provider_brands ON stores.provider_brand_id = provider_brands.id
              WHERE
                stores.state = states.code
                AND stores.active = true
              GROUP BY provider_brands.id
              ORDER BY provider_brands.name
            ) AS p
          )
        ),
        'features', (
          SELECT
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', jsonb_build_object(
                'type', 'Point',
                'coordinates', jsonb_build_array(st_x(location::geometry), st_y(location::geometry))
              ),
              'properties', jsonb_build_object(
                'id', stores.id,
                'provider_id', stores.provider_id,
                'provider_location_id', provider_location_id,
                'provider_brand_key', provider_brands.key,
                'provider_brand_name', provider_brands.name,
                'provider_brand_url', provider_brands.url,
                'name', stores.name,
                'address', address,
                'city', city,
                'state', state,
                'postal_code', postal_code,
                'time_zone', time_zone,
                'carries_vaccine', carries_vaccine,
                'appointments', appointments,
                'appointments_available', appointments_available,
                'appointments_last_fetched', appointments_last_fetched
              )
            )
            ORDER BY stores.id
          )
          FROM stores
          LEFT JOIN provider_brands ON provider_brands.id = stores.provider_brand_id
          WHERE stores.state = states.code
        )
      ) AS data
    FROM states
    LEFT JOIN stores ON stores.state = states.code AND stores.active = true
    GROUP BY states.id
    ORDER BY states.name
  `);
  await runShell("mkdir", ["-p", `${dataPath}/states`]);
  for (const state of statesData.rows) {
    await fs.writeFile(
      `${dataPath}/states/${state.code}.json`,
      JSON.stringify(state.data)
    );
  }

  try {
    await writeStoreData(dataPath, "albertsons");
  } catch (err) {
    logger.info("Albertsons Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "cvs");
  } catch (err) {
    logger.info("CVS Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "heb");
  } catch (err) {
    logger.info("H-E-B Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "kroger", { state: "CO" });
  } catch (err) {
    logger.info("Kroger Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "pharmaca");
  } catch (err) {
    logger.info("Pharmaca Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "rite_aid");
  } catch (err) {
    logger.info("Rite Aid Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "sams_club");
  } catch (err) {
    logger.info("Sam's Club Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "thrifty_white");
  } catch (err) {
    logger.info("Thrifty White Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "walgreens");
  } catch (err) {
    logger.info("Walgreens Data Error: ", err);
  }

  try {
    await writeStoreData(dataPath, "walmart");
  } catch (err) {
    logger.info("Walmart Data Error: ", err);
  }

  await runShell("./node_modules/@11ty/eleventy/cmd.js", [
    "--input",
    "site",
    "--output",
    "_site_build",
  ]);

  if (process.env.PUBLISH_SITE === "true") {
    logger.notice("Begin publishing website...");
    await runShell("aws", [
      "s3",
      "sync",
      "./_site_build/",
      `s3://${process.env.WWWVACCINESPOTTERORG_NAME}/`,
      "--cache-control",
      "public, max-age=10, s-maxage=30",
      "--delete",
    ]);
  }

  logger.notice("Finished refreshing website.");
};
