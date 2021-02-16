const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const getDatabase = require('../getDatabase');
const sleep = require('sleep-promise');

module.exports.importWalgreensZipCodes = async () => {
  const db = await getDatabase();
  const { container: zipCodesContainer } = await db.containers.createIfNotExists({ id: "zip_codes" });
  const { container } = await db.containers.createIfNotExists({ id: "walgreens_zip_codes" });

  let { resources: zipCodeResources } = await zipCodesContainer.items
    .query({
      query: "SELECT * from c ORDER BY c.id",
    })
    .fetchAll();
  for (const zipCode of zipCodeResources) {
    console.info(zipCode);
    await container.items.upsert({
      ...zipCode,
      lastFetched: null,
    });

    await sleep(50);
  }
}

module.exports.importWalgreensZipCodes();
