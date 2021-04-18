const csvParse = require("csv-parse");
const fs = require("fs");
const path = require("path");
const statesTopojson = require("us-atlas/states-10m");
const topojson = require("topojson-client");
const { State } = require("../models/State");

const states500kTopojson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../tmp/cb_2018_us_state_500k.topojson")
  )
);
const states5mTopojson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../tmp/cb_2018_us_state_5m.topojson")
  )
);

const statesGeojson = topojson.feature(
  statesTopojson,
  statesTopojson.objects.states
);

const states500kGeojson = topojson.feature(
  states500kTopojson,
  states500kTopojson.objects.cb_2018_us_state_500k
);

const states5mGeojson = topojson.feature(
  states5mTopojson,
  states5mTopojson.objects.cb_2018_us_state_5m
);

function geojsonForState(name) {
  const geojson = statesGeojson.features.find((f) => f.properties.name === name)
    ?.geometry;
  return geojson
    ? State.raw("ST_Multi(ST_GeomFromGeoJSON(?))", JSON.stringify(geojson))
    : null;
}

function geojson500kForState(name) {
  const geojson = states500kGeojson.features.find(
    (f) => f.properties.NAME === name
  )?.geometry;
  return geojson
    ? State.raw("ST_Multi(ST_GeomFromGeoJSON(?))", JSON.stringify(geojson))
    : null;
}

function geojson5mForState(name) {
  const geojson = states5mGeojson.features.find(
    (f) => f.properties.NAME === name
  )?.geometry;
  return geojson
    ? State.raw("ST_Multi(ST_GeomFromGeoJSON(?))", JSON.stringify(geojson))
    : null;
}

module.exports.importStates = async () => {
  const trx = await State.startTransaction();

  const states = {};

  const parser = fs
    .createReadStream(path.resolve(__dirname, "../../tmp/US/US.txt"))
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
          boundaries_500k: geojson500kForState(name),
          boundaries_5m: geojson5mForState(name),
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
      boundaries_500k: geojson500kForState("Puerto Rico"),
      boundaries_5m: geojson5mForState("Puerto Rico"),
    })
    .onConflict("code")
    .merge();

  await State.query(trx)
    .insert({
      country_code: "US",
      code: "VI",
      name: "United States Virgin Islands",
      boundaries: geojsonForState("United States Virgin Islands"),
      boundaries_500k: geojson500kForState("United States Virgin Islands"),
      boundaries_5m: geojson5mForState("United States Virgin Islands"),
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
