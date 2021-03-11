const execa = require("execa");
const fs = require("fs").promises;
const stringify = require("json-stable-stringify");
const path = require("path");
const del = require("del");
const mkdirp = require("mkdirp");
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
  if (logger.level.levelStr === "DEBUG") {
    cmd.stdout.pipe(process.stdout);
    cmd.stderr.pipe(process.stderr);
  }
  logger.info(cmd.spawnargs.join(" "));
  await cmd;
  logger.info(`Shell command complete (${cmd.spawnargs.join(" ")})`);
  return cmd;
}

module.exports.refreshWebsite = async () => {
  logger.notice("Begin refreshing website...");

  await del("./dist");

  const dataPath = path.resolve("website/static/api/v0");
  await mkdirp(dataPath);

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
            'appointments_last_fetched', p.appointments_last_fetched,
            'status', p.status
          )
        )
        FROM (
          SELECT
            provider_brands.*,
            COUNT(stores.id) AS location_count,
            MAX(appointments_last_fetched) AS appointments_last_fetched,
            CASE WHEN MAX(appointments_last_fetched) > (now() - interval '1 hour') THEN 'active' WHEN MAX(appointments_last_fetched) IS NULL THEN 'unknown' ELSE 'inactive' END AS status
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
  await fs.writeFile(`${dataPath}/states.json`, JSON.stringify(states.rows));
  for (const state of states.rows) {
    await mkdirp(`${dataPath}/stores/${state.code}`);
  }

  await Store.knex().raw(`
    UPDATE stores
    SET appointments_available = NULL, appointments = NULL
    WHERE
      appointments_last_fetched <= (now() - interval '1 hour')
      AND (
        appointments_available IS NOT NULL
        OR appointments IS NOT NULL
      )
  `);

  const statesData = await State.knex().raw(`
    SELECT
      states.code,
      jsonb_build_object(
        'type', 'FeatureCollection',
        'metadata', jsonb_build_object(
          'code', states.code,
          'name', states.name,
          'bounding_box', st_asgeojson(st_envelope(boundaries::geometry))::jsonb,
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
                'appointments_last_fetched', p.appointments_last_fetched,
                'status', p.status
              )
            )
            FROM (
              SELECT
                provider_brands.*,
                COUNT(stores.id) AS location_count,
                MAX(appointments_last_fetched) AS appointments_last_fetched,
                CASE WHEN MAX(appointments_last_fetched) > (now() - interval '1 hour') THEN 'active' WHEN MAX(appointments_last_fetched) IS NULL THEN 'unknown' ELSE 'inactive' END AS status
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
                'provider', stores.provider_id,
                'provider_location_id', provider_location_id,
                'provider_brand', provider_brands.key,
                'provider_brand_name', provider_brands.name,
                'url', coalesce(stores.url, provider_brands.url),
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
            ORDER BY CASE WHEN appointments_available = false THEN 1 WHEN appointments_available IS NULL THEN 2 WHEN appointments_available = true THEN 3 END, appointments_last_fetched DESC, city
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
  await mkdirp(`${dataPath}/states`);
  for (const state of statesData.rows) {
    await fs.writeFile(
      `${dataPath}/states/${state.code}.json`,
      JSON.stringify(state.data)
    );
  }

  const postalCodeData = await State.knex().raw(`
    SELECT
      state_code,
      jsonb_object_agg(
        postal_code, jsonb_build_array(st_x(location::geometry), st_y(location::geometry))
        ORDER BY postal_code
      ) AS data
    FROM postal_codes
    GROUP BY state_code
    ORDER BY state_code
  `);
  for (const state of postalCodeData.rows) {
    await mkdirp(`${dataPath}/states/${state.state_code}`);
    await fs.writeFile(
      `${dataPath}/states/${state.state_code}/postal_codes.json`,
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
    await writeStoreData(dataPath, "hyvee");
  } catch (err) {
    logger.info("Hy-Vee Data Error: ", err);
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

  await runShell("yarn", ["run", "generate"]);

  if (process.env.PUBLISH_SITE === "true") {
    logger.notice("Begin publishing website...");

    // Sync the cache-busted assets first out to S3. Otherwise, if new HTML
    // files get deployed first that reference these assets, we may
    // periodically have a half broken site (as the HTML pages can't find the
    // javascript files that haven't been synced yet).
    await runShell("aws", [
      "s3",
      "sync",
      "./dist/_nuxt/",
      `s3://${process.env.WWWVACCINESPOTTERORG_NAME}/_nuxt/`,
      "--cache-control",
      "public, max-age=10, s-maxage=30",
    ]);

    await runShell("aws", [
      "s3",
      "sync",
      "./dist/api/",
      `s3://${process.env.WWWVACCINESPOTTERORG_NAME}/api/`,
      "--cache-control",
      "public, max-age=10, s-maxage=30",
    ]);

    await runShell("aws", [
      "s3",
      "sync",
      "./dist/",
      `s3://${process.env.WWWVACCINESPOTTERORG_NAME}/`,
      "--cache-control",
      "public, max-age=10, s-maxage=30",
    ]);
  }

  logger.notice("Finished refreshing website.");
};
