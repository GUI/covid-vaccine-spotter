const sleep = require("sleep-promise");
const rollbar = require("./rollbarInit");

const logger = require("./logger");

function logError(message, err) {
  logger.error(message, err);
  if (err?.response?.headers) {
    logger.error(err.response.headers);
  }
  if (err?.response?.body) {
    logger.error(err.response.body);
  }
  if (err?.response?.data) {
    logger.error(err.response.data);
  }

  const custom = {};
  if (err?.response) {
    custom.response = {
      statusCode: err?.response?.statusCode,
      headers: err?.response?.headers,
      body: err?.response?.body,
      data: err?.response?.data,
    };
  }
  rollbar.error(err);
}

process.on("uncaughtException", (err) => {
  logError("Uncaught exception: ", err);
});

module.exports = async (task, sleepTime) => {
  const runOnce = process.env.RUN_ONCE === "true";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.info("Begin task run...");
    try {
      await task();
    } catch (err) {
      logError("Task error: ", err);
    }

    if (runOnce) {
      logger.notice("Exiting task");
      process.exit();
    }

    logger.info(`End task run, sleeping for ${sleepTime}ms...`);
    await sleep(sleepTime);
  }
};
