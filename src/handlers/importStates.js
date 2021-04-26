const csvParse = require("csv-parse");
const fs = require("fs");
const path = require("path");
const statesTopojson = require("us-atlas/states-10m");
const topojson = require("topojson-client");
const { State } = require("../models/State");
const { County } = require("../models/County");

const states500kTopojson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../tmp/cb_2019_us_state_500k.topojson")
  )
);
const states5mTopojson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../tmp/cb_2018_us_state_5m.topojson")
  )
);
const counties500kTopojson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../tmp/cb_2019_us_county_500k.topojson")
  )
);

const statesGeojson = topojson.feature(
  statesTopojson,
  statesTopojson.objects.states
);

const states500kGeojson = topojson.feature(
  states500kTopojson,
  states500kTopojson.objects.cb_2019_us_state_500k
);

const states5mGeojson = topojson.feature(
  states5mTopojson,
  states5mTopojson.objects.cb_2018_us_state_5m
);

const counties500kGeojson = topojson.feature(
  counties500kTopojson,
  counties500kTopojson.objects.cb_2019_us_county_500k
);

async function insertState(trx, code, name) {
  console.info(`Importing ${name}`);

  const statesData = statesGeojson.features.find(
    (f) => f.properties.name === name
  );
  const states500kData = states500kGeojson.features.find(
    (f) => f.properties.STUSPS === code
  );
  const states5mData = states5mGeojson.features.find(
    (f) => f.properties.STUSPS === code
  );

  const boundaries = statesData
    ? State.raw(
        "ST_Multi(ST_GeomFromGeoJSON(?))",
        JSON.stringify(statesData.geometry)
      )
    : null;

  const boundaries500k = states500kData
    ? State.raw(
        "ST_Multi(ST_GeomFromGeoJSON(?))",
        JSON.stringify(states500kData.geometry)
      )
    : null;

  const boundaries5m = states5mData
    ? State.raw(
        "ST_Multi(ST_GeomFromGeoJSON(?))",
        JSON.stringify(states5mData.geometry)
      )
    : null;

  return State.query(trx)
    .insert({
      country_code: "US",
      code,
      name,
      fips_code: states500kData?.properties.STATEFP,
      boundaries,
      boundaries_500k: boundaries500k,
      boundaries_5m: boundaries5m,
    })
    .onConflict("code")
    .merge();
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

      await insertState(trx, code, name);
      states[code] = true;
    }
  }

  await insertState(trx, "PR", "Puerto Rico");
  await insertState(trx, "VI", "United States Virgin Islands");

  const stateFipsCodes = {};
  for (const feature of counties500kGeojson.features) {
    console.info(
      `Importing county ${feature.properties.STATEFP} - ${feature.properties.NAME}`
    );
    if (!stateFipsCodes[feature.properties.STATEFP]) {
      stateFipsCodes[
        feature.properties.STATEFP
      ] = states500kGeojson.features.find(
        (f) => f.properties.STATEFP === feature.properties.STATEFP
      ).properties.STUSPS;
    }
    const stateCode = stateFipsCodes[feature.properties.STATEFP];
    if (stateCode === "AS" || stateCode === "GU" || stateCode === "MP") {
      continue;
    }

    const boundaries500k = County.raw(
      "ST_Multi(ST_GeomFromGeoJSON(?))",
      JSON.stringify(feature.geometry)
    );

    await County.query(trx)
      .insert({
        state_code: stateCode,
        fips_code: feature.properties.COUNTYFP,
        name: feature.properties.NAME,
        boundaries_500k: boundaries500k,
      })
      .onConflict(["state_code", "fips_code"])
      .merge();
  }

  try {
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  await State.knex().destroy();
};
