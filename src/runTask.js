const sleep = require("sleep-promise");
const rollbar = require("./rollbarInit");

const logger = require("./logger");

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception: ", err);
  rollbar.error(err);
});

module.exports = async (task, sleepTime) => {
  while (true) {
    logger.info("Begin task run...");
    try {
      await task();
    } catch (err) {
      logger.error("Task error: ", err);
      rollbar.error(err);
    }

    logger.info(`End task run, sleeping for ${sleepTime}ms...`);
    await sleep(sleepTime);
  }
};
