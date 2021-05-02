const Rollbar = require("rollbar");

const rollbar = new Rollbar({
  enabled: process.env.NODE_ENV === "production",
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  captureUncaught: process.env.NODE_ENV === "production",
  exitOnUncaughtException: true,
  captureUnhandledRejections: process.env.NODE_ENV === "production",
  verbose: true,
});

module.exports = rollbar;
