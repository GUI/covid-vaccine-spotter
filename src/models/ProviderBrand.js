const { Base } = require("./Base");

class ProviderBrand extends Base {
  static get tableName() {
    return "provider_brands";
  }
}

module.exports = {
  ProviderBrand,
};
