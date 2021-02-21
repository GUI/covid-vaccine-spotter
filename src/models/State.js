const { Base } = require('./base');

class State extends Base {
  static get tableName() {
    return 'states'
  }
}

module.exports = {
  State,
};
