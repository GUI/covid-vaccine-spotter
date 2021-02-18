const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const getDatabase = require('../getDatabase');
const sleep = require('sleep-promise');
const ZipCode = require('../models/ZipCode');

module.exports.importZipCodes = async () => {
  const rows = []
  fs.createReadStream(path.resolve(__dirname, '../../US/US.txt'))
    .pipe(csv.parse({ delimiter: '\t' }))
    .on('error', error => console.error(error))
    .on('data', (row) => {
      if(row[4] === 'CO') {
        rows.push(row);
      }
    }).on('end', async () => {
      for (const row of rows) {
        console.info(`Importing ${row[1]}...`);

        await ZipCode.put({
          id: row[1],
          sk: row[1],
          countryCode: row[0],
          city: row[2],
          state: row[3],
          stateCode: row[4],
          county: row[5],
          countyCode: row[6],
          latitude: row[9],
          longitude: row[10],
        });

        await sleep(50);
      }
    });
}

module.exports.importZipCodes();
