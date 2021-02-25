/* Imports and parses a list of states from a CSV, using geojson to populate state boundaries */

const csvParse = require("csv-parse");
const fs = require("fs");
const path = require("path");
const statesTopojson = require("us-atlas/states-10m");
const topojson = require("topojson-client");
const { State } = require("../models/State");

const statesGeojson = topojson.feature(
  statesTopojson,
  statesTopojson.objects.states
);

function geojsonForState(name) {
  const geojson = statesGeojson.features.find((f) => f.properties.name === name)
    ?.geometry;
  return geojson
    ? State.raw("ST_Multi(ST_GeomFromGeoJSON(?))", JSON.stringify(geojson))
    : null;
}

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
          boundaries: geojsonForState(name),
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
      boundaries: geojsonForState("Puerto Rico"),
    })
    .onConflict("code")
    .merge();

  await State.query(trx)
    .insert({
      country_code: "US",
      code: "VI",
      name: "United States Virgin Islands",
      boundaries: geojsonForState("United States Virgin Islands"),
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
