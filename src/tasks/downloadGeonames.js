const path = require("path");
const download = require("download");
const logger = require("../logger");

module.exports.downloadGeonames = async () => {
  const tmpPath = path.resolve(__dirname, "../../tmp");
  await download(
    "https://download.geonames.org/export/zip/US.zip",
    `${tmpPath}/US`,
    { extract: true }
  );
  await download(
    "https://download.geonames.org/export/zip/PR.zip",
    `${tmpPath}/PR`,
    { extract: true }
  );
  await download(
    "https://download.geonames.org/export/zip/VI.zip",
    `${tmpPath}/VI`,
    { extract: true }
  );
  logger.info(`Downloaded geonames data to ${tmpPath}`);
};
