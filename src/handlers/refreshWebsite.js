const execa = require("execa");
const fs = require("fs").promises;
const os = require("os");
const stringify = require("json-stable-stringify");
const ghpages = require("gh-pages");
const util = require("util");
const logger = require("../logger");
const getDatabase = require("../getDatabase");
const { Store } = require("../models/Store");
const { State } = require("../models/State");
const path = require("path");

const publish = util.promisify(ghpages.publish);

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
        'carries_vaccine', carries_vaccine,
        'appointments', appointments,
        'appointments_available', appointments_available,
        'appointments_last_fetched', appointments_last_fetched,
        'appointments_raw', appointments_raw
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
  const db = await getDatabase();
  const { container: krogerStores } = await db.containers.createIfNotExists({
    id: "kroger_stores",
  });
  const { container: pharmacaStores } = await db.containers.createIfNotExists({
    id: "pharmaca_stores",
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

  const { resources: krogerData } = await krogerStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(
    `${dataPath}/stores/CO/kroger.json`,
    stringify(krogerData, { space: "  " })
  );

  const { resources: pharmacaData } = await pharmacaStores.items
    .query(
      "SELECT * from c WHERE c.state = 'Colorado' OR c.state = 'CO' ORDER BY c.id"
    )
    .fetchAll();
  await fs.writeFile(
    `${dataPath}/stores/CO/pharmaca.json`,
    stringify(pharmacaData, { space: "  " })
  );

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

  console.info(
    "VACCINEFINDERNICKMORG_NAME: ",
    process.env.VACCINEFINDERNICKMORG_NAME
  );

  await runShell("aws", [
    "s3",
    "sync",
    "./_site_build/",
    `s3://${process.env.VACCINEFINDERNICKMORG_NAME}/`,
    "--cache-control",
    "public, max-age=0, s-maxage=10",
    "--delete",
  ]);

  await runShell("./node_modules/gh-pages/bin/gh-pages-clean.js");
  await publish("_site_build", {
    repo: `https://${process.env.GH_TOKEN}@github.com/GUI/vaccine.git`,
    dotfiles: true,
    silent: false,
    user: {
      name: "Auto Builder",
      email: "12112+GUI@users.noreply.github.com",
    },
  });
};
