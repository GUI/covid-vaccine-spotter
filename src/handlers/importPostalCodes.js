const csvParse = require('csv-parse');
const fs = require('fs');
const path = require('path');
const { PostalCode } = require('../models/PostalCode');

module.exports.importPostalCodes = async () => {
  const trx = await PostalCode.startTransaction();

  let batch = [];

  const parser = fs
    .createReadStream(path.resolve(__dirname, '../../US/US.txt'))
    .pipe(
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
    const stateCode = row[4];
    if (!stateCode) {
      continue;
    }

    const postalCode = row[1];
    console.info(`Importing ${postalCode}`);
    batch.push({
      state_code: stateCode,
      postal_code: postalCode,
      city: row[2],
      county_name: row[5],
      county_code: row[6],
      location: `point(${row[10]} ${row[9]})`,
    });

    if (batch.length >= 1000) {
      await PostalCode.query(trx)
        .insert(batch)
        .onConflict('postal_code')
        .merge();
      batch = [];
    }
  }

  const parserPr = fs
    .createReadStream(path.resolve(__dirname, '../../PR/PR.txt'))
    .pipe(
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
  for await (const row of parserPr) {
    const postalCode = row[1];
    console.info(`Importing ${postalCode}`);
    batch.push({
      state_code: 'PR',
      postal_code: row[1],
      city: row[2],
      county_name: row[3],
      county_code: row[4],
      location: `point(${row[10]} ${row[9]})`,
    });

    if (batch.length >= 1000) {
      await PostalCode.query(trx)
        .insert(batch)
        .onConflict('postal_code')
        .merge();
      batch = [];
    }
  }

  const parserVi = fs
    .createReadStream(path.resolve(__dirname, '../../VI/VI.txt'))
    .pipe(
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
  for await (const row of parserVi) {
    const postalCode = row[1];
    console.info(`Importing ${postalCode}`);
    batch.push({
      state_code: 'VI',
      postal_code: row[1],
      city: row[2],
      county_name: row[3],
      county_code: row[4],
      location: `point(${row[10]} ${row[9]})`,
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

  try {
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  await PostalCode.knex().destroy();
};

module.exports.importPostalCodes();
