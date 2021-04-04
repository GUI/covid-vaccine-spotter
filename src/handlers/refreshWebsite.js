const execa = require("execa");
const fs = require("fs").promises;
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
      JSON.stringify(state.state_data)
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
      MAX(COALESCE(stores.appointments_last_modified, stores.appointments_last_fetched)) AS appointments_last_modified,
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
            'appointments_last_modified', p.appointments_last_modified,
            'status', p.status
          )
        )
        FROM (
          SELECT
            provider_brands.*,
            COUNT(stores.id) AS location_count,
            MAX(appointments_last_fetched) AS appointments_last_fetched,
            MAX(COALESCE(appointments_last_modified, appointments_last_fetched)) AS appointments_last_modified,
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
          'appointments_last_modified', MAX(COALESCE(stores.appointments_last_modified, stores.appointments_last_fetched)),
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
                'appointments_last_modified', p.appointments_last_modified,
                'status', p.status
              )
            )
            FROM (
              SELECT
                provider_brands.*,
                COUNT(stores.id) AS location_count,
                MAX(appointments_last_fetched) AS appointments_last_fetched,
                MAX(COALESCE(appointments_last_modified, appointments_last_fetched)) AS appointments_last_modified,
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
                'provider_brand_id', provider_brands.id,
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
                'appointments_available_all_doses', CASE WHEN appointments_available IS NULL THEN NULL WHEN appointments_available AND (appointment_types->>'all_doses' = 'true' OR appointment_types->>'unknown' = 'true') THEN true ELSE false END,
                'appointments_available_2nd_dose_only', CASE WHEN appointments_available IS NULL THEN NULL WHEN appointments_available AND appointment_types->>'2nd_dose_only' = 'true' THEN true ELSE false END,
                'appointments_last_fetched', appointments_last_fetched,
                'appointments_last_modified', COALESCE(appointments_last_modified, appointments_last_fetched),
                'appointment_types', appointment_types,
                'appointment_vaccine_types', appointment_vaccine_types
              )
            )
            ORDER BY CASE WHEN appointments_available = false THEN 1 WHEN appointments_available IS NULL THEN 2 WHEN appointments_available = true THEN 3 END, COALESCE(appointments_last_modified, appointments_last_fetched) DESC, city
          )
          FROM stores
          LEFT JOIN provider_brands ON provider_brands.id = stores.provider_brand_id
          WHERE stores.state = states.code
          AND stores.active = true
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

    // Pre-compress all files.
    await runShell("find", [
      "./dist",
      "-type",
      "f",
      "-print",
      "-exec",
      "gzip",
      "-n",
      "{}",
      ";",
      "-exec",
      "mv",
      "{}.gz",
      "{}",
      ";",
    ]);

    // Sync to a temporary local dir to preserve timestamps.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--checksum",
      "--no-times",
      "./dist/",
      "./tmp/dist-sync/",
    ]);

    // Sync the cache-busted assets first out to S3. Otherwise, if new HTML
    // files get deployed first that reference these assets, we may
    // periodically have a half broken site (as the HTML pages can't find the
    // javascript files that haven't been synced yet).
    await runShell("rclone", [
      "copy",
      "-v",
      "--header-upload",
      "Cache-Control: public, max-age=600, s-maxage=600",
      "--header-upload",
      "Content-Encoding: gzip",
      "./tmp/dist-sync/_nuxt/",
      `:gcs:${process.env.WEBSITE_BUCKET}/_nuxt/`,
    ]);

    // Sync the API files first to ensure they're live before other files that
    // rely on them might go live.
    await runShell("rclone", [
      "copy",
      "-v",
      "--header-upload",
      "Cache-Control: public, max-age=15, s-maxage=40",
      "--header-upload",
      "Content-Encoding: gzip",
      "--exclude",
      "v0/states/*/postal_codes.json",
      "./tmp/dist-sync/api/",
      `:gcs:${process.env.WEBSITE_BUCKET}/api/`,
    ]);

    // Sync postal code files that are more static and can have longer cache
    // durations.
    await runShell("rclone", [
      "copy",
      "-v",
      "--header-upload",
      "Cache-Control: public, max-age=600, s-maxage=600",
      "--header-upload",
      "Content-Encoding: gzip",
      "--include",
      "v0/states/*/postal_codes.json",
      "./tmp/dist-sync/api/",
      `:gcs:${process.env.WEBSITE_BUCKET}/api/`,
    ]);

    // Sync the remaining files.
    await runShell("rclone", [
      "copy",
      "-v",
      "--header-upload",
      "Cache-Control: public, max-age=15, s-maxage=40",
      "--header-upload",
      "Content-Encoding: gzip",
      "--exclude",
      "api/**",
      "--exclude",
      "_nuxt/**",
      "./tmp/dist-sync/",
      `:gcs:${process.env.WEBSITE_BUCKET}/`,
    ]);

    // Each new deployment contains a new timestamped directory of assets in
    // _nuxt/static/*. To prevent these from growing indefinitely (which can
    // slow down other syncs), prune all but the last 15. We keep some previous
    // deployments around to prevent race conditions with someone loading an
    // old HTML file that may still rely on the previous deployed assets (15 is
    // probably overkill, but just to be safe).
    const staticDirsCmd = await runShell("rclone", [
      "lsjson",
      `:gcs:${process.env.WEBSITE_BUCKET}/_nuxt/static/`,
    ]);
    const staticDirs = JSON.parse(staticDirsCmd.stdout).map((d) => d.Path);
    staticDirs.sort();
    const keepCount = 15;
    const staticDirsKeep = staticDirs.slice(-1 * keepCount);
    const staticDirsDelete = staticDirs.slice(0, -1 * keepCount);
    logger.info(
      `Deleting old _nuxt/static dirs: ${staticDirsDelete}. Keeping: ${staticDirsKeep}`
    );
    for (const dir of staticDirsDelete) {
      await runShell("rclone", [
        "purge",
        "-v",
        `:gcs:${process.env.WEBSITE_BUCKET}/_nuxt/static/${dir}`,
      ]);
    }
  }

  logger.notice("Finished refreshing website.");
};
