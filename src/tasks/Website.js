const fs = require("fs").promises;
const mkdirp = require("mkdirp");
const del = require("del");
const path = require("path");
const logger = require("../logger");
const runShell = require("../utils/runShell");
const { Store } = require("../models/Store");
const { State } = require("../models/State");

class Website {
  static async apiDataBuild() {
    logger.notice("Begin building API data...");

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

    logger.notice("Finished building API data.");
  }

  static async apiDataPublish() {
    logger.notice("Begin publishing API data...");

    // Pre-compress all files.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--exclude",
      "api/v0/stores",
      "--include",
      "api/***",
      "--exclude",
      "*",
      "./website/static/",
      "./tmp/website-api-data-gzip/",
    ]);
    await runShell("find", [
      "./tmp/website-api-data-gzip",
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

    // Sync to a temp dir with checksums to preserve timestamps across runs.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--checksum",
      "--no-times",
      "./tmp/website-api-data-gzip/",
      "./tmp/website-api-data-sync/",
    ]);

    await runShell("rclone", [
      "copy",
      "-v",
      "--update",
      "--use-server-modtime",
      "--header-upload",
      "Cache-Control: public, max-age=15, s-maxage=40",
      "--header-upload",
      "Content-Encoding: gzip",
      "--exclude",
      "v0/states/*/postal_codes.json",
      "./tmp/website-api-data-sync/api/",
      `:s3:${process.env.WEBSITE_BUCKET}/api/`,
    ]);

    // Sync postal code files that are more static and can have longer cache
    // durations.
    await runShell("rclone", [
      "copy",
      "-v",
      "--update",
      "--use-server-modtime",
      "--header-upload",
      "Cache-Control: public, max-age=600, s-maxage=3600",
      "--header-upload",
      "Content-Encoding: gzip",
      "--filter",
      "+ v0/states/*/postal_codes.json",
      "--filter",
      "- *",
      "./tmp/website-api-data-sync/api/",
      `:s3:${process.env.WEBSITE_BUCKET}/api/`,
    ]);

    logger.notice("Finished publishing API data.");
  }

  static async apiDataBuildAndPublish() {
    await Website.apiDataBuild();
    await Website.apiDataPublish();
  }

  static async legacyApiDataWriteStoreData(dataPath, brand, conditions = {}) {
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
      await mkdirp(`${dataPath}/stores/${state.state}`);
      await fs.writeFile(
        `${dataPath}/stores/${state.state}/${brand}.json`,
        JSON.stringify(state.state_data)
      );
    }

    logger.info(`Finished writing data for ${brand}`);
  }

  static async legacyApiDataBuild() {
    logger.notice("Begin building legacy API data...");

    const dataPath = path.resolve("website/static/api/v0");
    await mkdirp(dataPath);

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "albertsons");
    } catch (err) {
      logger.info("Albertsons Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "cvs");
    } catch (err) {
      logger.info("CVS Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "heb");
    } catch (err) {
      logger.info("H-E-B Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "hyvee");
    } catch (err) {
      logger.info("Hy-Vee Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "kroger", {
        state: "CO",
      });
    } catch (err) {
      logger.info("Kroger Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "pharmaca");
    } catch (err) {
      logger.info("Pharmaca Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "rite_aid");
    } catch (err) {
      logger.info("Rite Aid Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "sams_club");
    } catch (err) {
      logger.info("Sam's Club Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "thrifty_white");
    } catch (err) {
      logger.info("Thrifty White Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "walgreens");
    } catch (err) {
      logger.info("Walgreens Data Error: ", err);
    }

    try {
      await Website.legacyApiDataWriteStoreData(dataPath, "walmart");
    } catch (err) {
      logger.info("Walmart Data Error: ", err);
    }

    logger.notice("Finished building legacy API data.");
  }

  static async legacyApiDataPublish() {
    logger.notice("Begin publishing legacy API data...");

    // Pre-compress all files.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--include",
      "api",
      "--include",
      "api/v0",
      "--include",
      "api/v0/stores",
      "--include",
      "api/v0/stores/***",
      "--exclude",
      "*",
      "./website/static/",
      "./tmp/website-legacy-api-data-gzip/",
    ]);
    await runShell("find", [
      "./tmp/website-legacy-api-data-gzip",
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

    // Sync to a temp dir with checksums to preserve timestamps across runs.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--checksum",
      "--no-times",
      "./tmp/website-legacy-api-data-gzip/",
      "./tmp/website-legacy-api-data-sync/",
    ]);

    await runShell("rclone", [
      "copy",
      "-v",
      "--update",
      "--use-server-modtime",
      "--header-upload",
      "Cache-Control: public, max-age=15, s-maxage=40",
      "--header-upload",
      "Content-Encoding: gzip",
      "./tmp/website-legacy-api-data-sync/api/",
      `:s3:${process.env.WEBSITE_BUCKET}/api/`,
    ]);

    logger.notice("Finished publishing legacy API data.");
  }

  static async legacyApiDataBuildAndPublish() {
    await Website.legacyApiDataBuild();
    await Website.legacyApiDataPublish();
  }

  static async staticSiteBuild() {
    logger.notice("Begin building static site...");

    await Website.apiDataBuild();
    await Website.legacyApiDataBuild();

    await del("./dist");
    await runShell("yarn", ["run", "generate"]);

    logger.notice("Finished building static site.");
  }

  static async staticSitePublish() {
    logger.notice("Begin publishing static site...");

    // Pre-compress all files.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "./dist/",
      "./tmp/website-static-site-gzip/",
    ]);
    await runShell("find", [
      "./tmp/website-static-site-gzip",
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

    // Sync to a temp dir with checksums to preserve timestamps across runs.
    await runShell("rsync", [
      "-a",
      "-v",
      "--delete",
      "--checksum",
      "--no-times",
      "./tmp/website-static-site-gzip/",
      "./tmp/website-static-site-sync/",
    ]);

    // Sync the cache-busted assets first out to S3. Otherwise, if new HTML
    // files get deployed first that reference these assets, we may
    // periodically have a half broken site (as the HTML pages can't find the
    // javascript files that haven't been synced yet).
    await runShell("rclone", [
      "copy",
      "-v",
      "--update",
      "--use-server-modtime",
      "--header-upload",
      "Cache-Control: public, max-age=600, s-maxage=86400",
      "--header-upload",
      "Content-Encoding: gzip",
      "./tmp/website-static-site-sync/_nuxt/",
      `:s3:${process.env.WEBSITE_BUCKET}/_nuxt/`,
    ]);

    // Sync the remaining files.
    await runShell("rclone", [
      "copy",
      "-v",
      "--update",
      "--use-server-modtime",
      "--header-upload",
      "Cache-Control: public, max-age=15, s-maxage=40",
      "--header-upload",
      "Content-Encoding: gzip",
      "--exclude",
      "api/**",
      "--exclude",
      "_nuxt/**",
      "./tmp/website-static-site-sync/",
      `:s3:${process.env.WEBSITE_BUCKET}/`,
    ]);

    // Each new deployment contains a new timestamped directory of assets in
    // _nuxt/static/*. To prevent these from growing indefinitely (which can
    // slow down other syncs), prune all but the last 15. We keep some previous
    // deployments around to prevent race conditions with someone loading an
    // old HTML file that may still rely on the previous deployed assets (15 is
    // probably overkill, but just to be safe).
    const staticDirsCmd = await runShell("rclone", [
      "lsjson",
      "--no-modtime",
      "--no-mimetype",
      `:s3:${process.env.WEBSITE_BUCKET}/_nuxt/static/`,
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
        `:s3:${process.env.WEBSITE_BUCKET}/_nuxt/static/${dir}`,
      ]);
    }

    logger.notice("Finished publishing static site.");
  }

  static async staticSiteBuildAndPublish() {
    await Website.staticSiteBuild();
    await Website.staticSitePublish();
  }
}

module.exports = Website;
