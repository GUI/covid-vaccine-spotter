const { Base } = require("./Base");

class Date extends Base {
  static get tableName() {
    return "dates";
  }
}

module.exports = {
  Date,
};
