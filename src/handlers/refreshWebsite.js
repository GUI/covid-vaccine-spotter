const execa = require("execa");
const fs = require("fs").promises;
const stringify = require("json-stable-stringify");
const path = require("path");
const logger = require("../logger");
const getDatabase = require("../getDatabase");
const { Store } = require("../models/Store");
const { State } = require("../models/State");

async function writeStoreData(dataPath, brand) {
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

  const db = await getDatabase();
  const { container: krogerStores } = await db.containers.createIfNotExists({
    id: "kroger_stores",
  });

  const dataPath = path.resolve("site/api/v0");
  await runShell("rm", ["-rf", "_site_build", dataPath]);
  await runShell("mkdir", ["-p", dataPath]);

  const states = await State.query().select("code", "name").orderBy("name");
  await fs.writeFile(
    `${dataPath}/states.json`,
    stringify(states, { space: "  " })
  );
  for (const state of states) {
    await runShell("mkdir", ["-p", `${dataPath}/stores/${state.code}`]);
  }

  try {
    await writeStoreData(dataPath, "albertsons");
  } catch (err) {
    logger.info("CVS Data Error: ", err);
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

  const { resources: krogerData } = await krogerStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(
    `${dataPath}/stores/CO/kroger.json`,
    stringify(krogerData, { space: "  " })
  );

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
      "public, max-age=0, s-maxage=10",
      "--delete",
    ]);
  }

  logger.notice("Finished refreshing website.");
};
