const path = require("path");
const download = require("download");
const logger = require("../logger");

module.exports.downloadGeonames = async () => {
  const tmpPath = path.resolve(__dirname, "../../tmp");

  await download(
    "https://download.geonames.org/export/zip/US.zip",
    `${tmpPath}/US`,
    { extract: true }
  ).catch((err) => {
    logger.error(err);
  });

  await download(
    "https://download.geonames.org/export/zip/PR.zip",
    `${tmpPath}/PR`,
    { extract: true }
  ).catch((err) => {
    logger.error(err);
  });

  await download(
    "https://download.geonames.org/export/zip/VI.zip",
    `${tmpPath}/VI`,
    { extract: true }
  ).catch((err) => {
    logger.error(err);
  });

  await download(
    "https://gist.githubusercontent.com/GUI/ab9d1aabbee11fde8e91d6691f18601c/raw/b3463e197157a90393e0525199cdcf79d98aa300/cb_2018_us_state_500k.topojson",
    tmpPath
  ).catch((err) => {
    logger.error(err);
  });

  await download(
    "https://gist.githubusercontent.com/GUI/a278b218b5f133196f0744968e58d8ac/raw/b3c09d0c36cf33f5d40cd22767a7d154e04f34ef/cb_2018_us_state_5m.topojson",
    tmpPath
  ).catch((err) => {
    logger.error(err);
  });

  logger.info(`Downloaded geonames data to ${tmpPath}`);
};
