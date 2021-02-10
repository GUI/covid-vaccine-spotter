const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

const adapter = new FileSync('zip_codes.json');
const db = low(adapter);
db.defaults({ zipCodes: [] }).write();

const zipCodes = db.get('zipCodes');
zipCodes.remove().write();

fs.createReadStream(path.resolve(__dirname, 'US', 'US.txt'))
  .pipe(csv.parse({ delimiter: '\t' }))
  .on('error', error => console.error(error))
  .on('data', row => {
    if(row[4] === 'CO') {
      zipCodes.push(row[1]).write();
    }
  })
