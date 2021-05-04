const Rollbar = require("rollbar");

const rollbar = new Rollbar({
  enabled: process.env.NODE_ENV === "production",
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  captureUncaught: process.env.NODE_ENV === "production",
  captureUnhandledRejections: process.env.NODE_ENV === "production",
});

module.exports = rollbar;
