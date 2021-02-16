const getDatabase = require('../getDatabase');
const _ = require('lodash');
const dateAdd = require('date-fns/add')
const got = require('got');
const sleep = require('sleep-promise');

module.exports.findWalmartStores = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "walmart_stores" });

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo",
      parameters: [
        { name: '@minsAgo', value: dateAdd(new Date(), { minutes: -2 }).toISOString() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i++;
    console.info(`Processing ${resource.displayName} (${i} of ${resources.length})...`);

    if (resource.address.state !== 'CO') {
      await container.item(resource.id).delete();
    }
  }
};

module.exports.findWalmartStores();
