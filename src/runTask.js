const sleep = require("sleep-promise");
const logger = require("./logger");

process.on("uncaughtException", function (err) {
  logger.error("Uncaught exception: ", err);
});

module.exports = async (task, sleepTime) => {
  while (true) {
    logger.info("Begin task run...");
    try {
      await task();
    } catch (err) {
      logger.error("Task error: ", err);
    }

    logger.info("End task run, sleeping...");
    await sleep(sleepTime);
  }
};
