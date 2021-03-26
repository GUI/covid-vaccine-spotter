const { Base } = require("./Base");

class Cache extends Base {
  static get tableName() {
    return "cache";
  }
}

module.exports = {
  Cache,
};
