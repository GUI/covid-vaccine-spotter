const { Base } = require("./Base");

class Store extends Base {
  static get tableName() {
    return "stores";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        appointments: {
          type: "array",
          items: { type: "string" },
        },
      },
    };
  }
}

module.exports = {
  Store,
};
