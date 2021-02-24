const execa = require("execa");
const fs = require("fs").promises;
const os = require("os");
const stringify = require("json-stable-stringify");
const del = require("del");
const ghpages = require("gh-pages");
const util = require("util");
const logger = require("../logger");
const getDatabase = require("../getDatabase");
const { Store } = require("../models/Store");

const publish = util.promisify(ghpages.publish);

async function writeStoreData(tmp, brand, dataDir) {
  await execa("mkdir", ["-p", `${tmp}/site/_data/${dataDir}`]);

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
    .groupBy("state")
    .orderBy("state");
  for (const state of states) {
    await fs.writeFile(
      `${tmp}/site/_data/${dataDir}/${state.state}.json`,
      stringify(state.state_data, { space: "  " })
    );
  }
}

module.exports.refreshWebsite = async () => {
  const db = await getDatabase();
  const { container: krogerStores } = await db.containers.createIfNotExists({
    id: "kroger_stores",
  });
  const { container: pharmacaStores } = await db.containers.createIfNotExists({
    id: "pharmaca_stores",
  });
  const { container: walgreensStores } = await db.containers.createIfNotExists({
    id: "walgreens_stores",
  });

  const { stdout } = await execa("ls", ["-lh", os.tmpdir()]);
  logger.info(stdout);
  await del([`${os.tmpdir()}/covid-vaccine-finder*`], { force: true });
  const tmp = await fs.mkdtemp(`${os.tmpdir()}/covid-vaccine-finder`);
  logger.info(tmp);
  await execa("cp", ["-r", "./site", `${tmp}/`]);
  await execa("rm", ["-rf", `${tmp}/site/_data`]);
  await execa("mkdir", ["-p", `${tmp}/site/_data`]);

  try {
    writeStoreData(tmp, "albertsons", "albertsons");
  } catch (err) {
    logger.info("CVS Data Error: ", err);
  }

  try {
    writeStoreData(tmp, "cvs", "cvs");
  } catch (err) {
    logger.info("CVS Data Error: ", err);
  }

  const { resources: krogerData } = await krogerStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(
    `${tmp}/site/_data/kroger.json`,
    stringify(krogerData, { space: "  " })
  );

  const { resources: pharmacaData } = await pharmacaStores.items
    .query(
      "SELECT * from c WHERE c.state = 'Colorado' OR c.state = 'CO' ORDER BY c.id"
    )
    .fetchAll();
  await fs.writeFile(
    `${tmp}/site/_data/pharmaca.json`,
    stringify(pharmacaData, { space: "  " })
  );

  try {
    writeStoreData(tmp, "sams_club", "samsClub");
  } catch (err) {
    logger.info("Sam's Club Data Error: ", err);
  }

  const { resources: walgreensData } = await walgreensStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(
    `${tmp}/site/_data/walgreens.json`,
    stringify(walgreensData, { space: "  " })
  );

  try {
    writeStoreData(tmp, "walmart", "walmart");
  } catch (err) {
    logger.info("Walmart Data Error: ", err);
  }

  await execa("./node_modules/@11ty/eleventy/cmd.js", [
    "--input",
    `${tmp}/site`,
    "--output",
    `${tmp}/_site`,
  ]);
  await execa("cp", ["-r", `${tmp}/site/_data`, `${tmp}/_site/`]);
  await execa("./node_modules/gh-pages/bin/gh-pages-clean.js");

  await publish(`${tmp}/_site`, {
    repo: `https://${process.env.GH_TOKEN}@github.com/GUI/vaccine.git`,
    dotfiles: true,
    silent: false,
    user: {
      name: "Auto Builder",
      email: "12112+GUI@users.noreply.github.com",
    },
  });

  // await Store.knex().destroy();
};

// module.exports.refreshWebsite();
