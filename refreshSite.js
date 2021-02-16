const stringify = require('json-stable-stringify');
const getDatabase = require('./getDatabase');
const fs = require('fs').promises;

(async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "albertsons_stores" });

  let { resources } = await container.items
    .query("SELECT * from c WHERE c.clientName != null ORDER BY c.id")
    .fetchAll();
  await fs.writeFile('site/_data/albertsons.json', stringify(resources, { space: '  ' }));

  ghpages.publish('_site');
})();
