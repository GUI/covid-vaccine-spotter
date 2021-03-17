const { Base } = require("./Base");

class Provider extends Base {
  static get tableName() {
    return "providers";
  }
}

module.exports = {
  Provider,
};
