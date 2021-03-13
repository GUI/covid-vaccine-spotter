const sleep = require("sleep-promise");
const logger = require("./logger");

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception: ", err);
});

module.exports = async (task, sleepTime) => {
  runOnce = ((process.env.RUN_ONCE || "false") === "true");
  while (true) {
    logger.info("Begin task run...");
    try {
      await task();
    } catch (err) {
      logger.error("Task error: ", err);
    }

    if (runOnce) {
      logger.notice("Exiting task");
      break;
    }

    logger.info(`End task run, sleeping for ${sleepTime}ms...`);
    await sleep(sleepTime);
  }
};
