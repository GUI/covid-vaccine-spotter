const log4js = require("log4js");

log4js.levels.addLevels({
  NOTICE: { value: log4js.levels.getLevel("INFO").level + 1, colour: "green" },
});

const logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || "debug";

module.exports = logger;
