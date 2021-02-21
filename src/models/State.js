const { Base } = require("./Base");

class State extends Base {
  static get tableName() {
    return "states";
  }
}

module.exports = {
  State,
};
