const getDatabase = require('../getDatabase');
const _ = require('lodash');
const got = require('got');

module.exports.refreshCvs = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "cvs_cities" });

  console.info(`Processing CVS...`);

  const lastFetched = (new Date()).toISOString();

  const resp = await got('https://www.cvs.com/immunizations/covid-19-vaccine.vaccine-status.CO.json?vaccineinfo', {
    headers: {
      'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      'Referer': 'https://www.cvs.com/immunizations/covid-19-vaccine',
    },
    responseType: 'json',
    retry: 0,
  });
  console.info(resp.body);

  if (resp.body.responsePayloadData && !_.isEmpty(resp.body.responsePayloadData.data)) {
    for (const city of resp.body.responsePayloadData.data.CO) {
      await container.items.upsert({
        id: `${city.state}-${city.city}`,
        ...city,
        lastFetched,
      });
    }
  }

  let { resources } = await container.items
    .query({
      query: "SELECT * from c",
    })
    .fetchAll();
  for (const resource of resources) {
    await container.items.upsert({
      ...resource,
      lastFetched,
    });
  }
}

// module.exports.refreshCvs();
