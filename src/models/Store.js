const { Base } = require("./Base");

class Store extends Base {
  static get tableName() {
    return "stores";
  }
}

module.exports = {
  Store,
};
