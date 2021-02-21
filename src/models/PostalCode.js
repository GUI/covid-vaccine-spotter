const { Base } = require("./Base");

class PostalCode extends Base {
  static get tableName() {
    return "postal_codes";
  }
}

module.exports = {
  PostalCode,
};
