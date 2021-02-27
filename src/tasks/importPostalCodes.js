const csvParse = require('csv-parse');
const fs = require('fs');
const path = require('path');
const download = require('download');
const geoTz = require('geo-tz');
const logger = require('../logger');
const { PostalCode } = require('../models/PostalCode');

async function importGeoNamesFile(
  trx,
  filePath,
  {
    postalCodeColumn = 1,
    cityColumn = 2,
    stateCodeColumn = 4,
    countyNameColumn = 5,
    countyCodeColumn = 6,
    latitudeColumn = 9,
    longitudeColumn = 10,
  } = {}
) {
  let batch = [];

  const parser = fs.createReadStream(filePath).pipe(
    csvParse({
      delimiter: '\t',
      cast: (value) => {
        if (value === '') {
          return null;
        }
        return value;
      },
    })
  );
  for await (const row of parser) {
    const stateCode = row[stateCodeColumn];
    if (!stateCode) {
      logger.warn(`Skipping row with missing state: ${row}`);
      continue;
    }

    const postalCode = row[postalCodeColumn];
    logger.info(`Importing ${postalCode}`);

    const timeZones = geoTz(row[latitudeColumn], row[longitudeColumn]);
    if (timeZones.length > 1) {
      logger.warn(
        `More than 1 possible time zone detected for ${postalCode}: ${timeZones}`
      );
    } else if (timeZones.length === 0) {
      logger.warn(`No time zone detected for ${postalCode}: ${timeZones}`);
    }

    batch.push({
      state_code: stateCode,
      postal_code: postalCode,
      city: row[cityColumn],
      county_name: row[countyNameColumn],
      county_code: row[countyCodeColumn],
      location: `point(${row[longitudeColumn]} ${row[latitudeColumn]})`,
      time_zone: timeZones[0],
    });

    if (batch.length >= 1000) {
      await PostalCode.query(trx)
        .insert(batch)
        .onConflict('postal_code')
        .merge();
      batch = [];
    }
  }

  if (batch.length > 0) {
    await PostalCode.query(trx).insert(batch).onConflict('postal_code').merge();
  }
}

module.exports.importPostalCodes = async () => {
  const trx = await PostalCode.startTransaction();

  const tmpPath = path.resolve(__dirname, '../../tmp');
  await download(
    'https://download.geonames.org/export/zip/US.zip',
    `${tmpPath}/US`,
    { extract: true }
  );
  await download(
    'https://download.geonames.org/export/zip/PR.zip',
    `${tmpPath}/PR`,
    { extract: true }
  );
  await download(
    'https://download.geonames.org/export/zip/VI.zip',
    `${tmpPath}/VI`,
    { extract: true }
  );

  await importGeoNamesFile(trx, `${tmpPath}/US/US.txt`);
  await importGeoNamesFile(trx, `${tmpPath}/PR/PR.txt`, {
    stateCodeColumn: 0,
    countyNameColumn: 3,
    countyCodeColumn: 4,
  });
  await importGeoNamesFile(trx, `${tmpPath}/VI/VI.txt`, { stateCodeColumn: 0 });

  try {
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  await PostalCode.knex().destroy();
};
