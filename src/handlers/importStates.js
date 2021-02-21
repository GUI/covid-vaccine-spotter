const csvParse = require("csv-parse");
const fs = require("fs");
const path = require("path");
const { State } = require("../models/State");

module.exports.importStates = async () => {
  const trx = await State.startTransaction();

  const states = {};

  const parser = fs
    .createReadStream(path.resolve(__dirname, "../../US/US.txt"))
    .pipe(
      csvParse({
        delimiter: "\t",
        cast: (value) => {
          if (value === "") {
            return null;
          }
          return value;
        },
      })
    );
  for await (const row of parser) {
    const code = row[4];
    if (!states[code]) {
      let name = row[3];
      if (code === "MH" && !name) {
        name = "Marshall Islands";
      } else if (!code) {
        continue;
      }

      console.info(`Importing ${name}`);

      await State.query(trx)
        .insert({
          country_code: row[0],
          code,
          name,
        })
        .onConflict("code")
        .merge();

      states[code] = true;
    }
  }

  await State.query(trx)
    .insert({
      country_code: "US",
      code: "PR",
      name: "Puerto Rico",
    })
    .onConflict("code")
    .merge();

  try {
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  await State.knex().destroy();
};

module.exports.importStates();
