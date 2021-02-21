const { Base } = require("./base");

class PostalCode extends Base {
  static get tableName() {
    return "postal_codes";
  }
}

module.exports = {
  PostalCode,
};
