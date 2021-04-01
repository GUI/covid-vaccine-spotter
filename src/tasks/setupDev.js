const fs = require("fs");
const download = require("download");

const createDirRecursive = (path) => {
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
  });
};

const apiBaseUri = `https://www.vaccinespotter.org/api/v0`;

const baseStaticAssetsDir = `website/static/api/v0/`;
createDirRecursive(baseStaticAssetsDir);
(async () => {
  // Download the state data first for state code scraping
  await download(`${apiBaseUri}/states.json`, baseStaticAssetsDir);
  const stateData = JSON.parse(
    fs.readFileSync(`${baseStaticAssetsDir}/states.json`)
  );
  const vaccineSpotterApiFetchPromises = [];
  stateData.forEach((state) => {
    const statesDir = `${baseStaticAssetsDir}/states`;
    const statePostalCodeDir = `${statesDir}/${state.code}`;
    const stateDataUri = `${apiBaseUri}/states/${state.code}.json`;
    const statePostalCodeUri = `${apiBaseUri}/states/${state.code}/postal_codes.json`;
    vaccineSpotterApiFetchPromises.push(
      download(stateDataUri, statesDir).catch((error) => {
        console.log(
          `ERROR downloading ${state.name} (${state.code}) data: ${error}`
        );
      })
    );
    createDirRecursive(statePostalCodeDir);
    vaccineSpotterApiFetchPromises.push(
      download(statePostalCodeUri, statePostalCodeDir).catch((error) => {
        console.log(
          `ERROR downloading ${state.name} (${state.code}) postal code data: ${error}`
        );
      })
    );
  });
  Promise.all(vaccineSpotterApiFetchPromises);
})();
