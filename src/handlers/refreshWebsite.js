const execa = require('execa');
const fs = require('fs').promises;
const os = require('os');
const getDatabase = require('../getDatabase');
const stringify = require('json-stable-stringify');
const del = require('del');
const ghpages = require('gh-pages');
const util = require('util');

const publish = util.promisify(ghpages.publish);

module.exports.refreshWebsite = async () => {
  const db = await getDatabase();
  const { container: albertsonsStores } = await db.containers.createIfNotExists({ id: "albertsons_stores" });
  const { container: cvsCities } = await db.containers.createIfNotExists({ id: "cvs_cities" });
  const { container: krogerStores } = await db.containers.createIfNotExists({ id: "kroger_stores" });
  const { container: pharmacaStores } = await db.containers.createIfNotExists({ id: "pharmaca_stores" });
  const { container: walgreensStores } = await db.containers.createIfNotExists({ id: "walgreens_stores" });
  const { container: walmartStores } = await db.containers.createIfNotExists({ id: "walmart_stores" });

  const { stdout } = await execa('ls', ['-lh', os.tmpdir()])
  console.info(stdout);
  await del([`${os.tmpdir()}/covid-vaccine-finder*`], { force: true });
  const tmp = await fs.mkdtemp(`${os.tmpdir()}/covid-vaccine-finder`);
  console.info(tmp);
  await execa('cp', ['-r', './site', `${tmp}/`])
  await execa('mkdir', ['-p', `${tmp}/site/_data`])

  const { resources: albertsonsData } = await albertsonsStores.items
    .query("SELECT * from c WHERE c.clientName != null ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/albertsons.json`, stringify(albertsonsData, { space: '  ' }));

  const { resources: cvsData } = await cvsCities.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/cvs.json`, stringify(cvsData, { space: '  ' }));

  const { resources: krogerData } = await krogerStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/kroger.json`, stringify(krogerData, { space: '  ' }));

  const { resources: pharmacaData } = await pharmacaStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/pharmaca.json`, stringify(pharmacaData, { space: '  ' }));

  const { resources: walgreensData } = await walgreensStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/walgreens.json`, stringify(walgreensData, { space: '  ' }));

  const { resources: walmartData } = await walmartStores.items
    .query("SELECT * from c ORDER BY c.id")
    .fetchAll();
  await fs.writeFile(`${tmp}/site/_data/walmart.json`, stringify(walmartData, { space: '  ' }));

  await execa('./node_modules/@11ty/eleventy/cmd.js', ['--input', `${tmp}/site`, '--output', `${tmp}/_site`]);
  await execa('cp', ['-r', `${tmp}/site/_data`, `${tmp}/_site/`]);
  await execa('./node_modules/gh-pages/bin/gh-pages-clean.js');

  await publish(`${tmp}/_site`, {
    repo: `https://${process.env.GH_TOKEN}@github.com/GUI/vaccine.git`,
    dotfiles: true,
    silent: false,
    user: {
      name: 'Auto Builder',
      email: '12112+GUI@users.noreply.github.com',
    },
  });
}

// module.exports.refreshWebsite();
