const mod = {};
if (process.client) {
  // eslint-disable-next-line global-require
  mod.Collapse = require("bootstrap/js/dist/collapse");
}

export default mod;
