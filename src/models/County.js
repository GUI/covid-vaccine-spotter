const { Base } = require("./Base");

class County extends Base {
  static get tableName() {
    return "counties";
  }
}

module.exports = {
  County,
};
