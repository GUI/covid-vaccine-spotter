const Knex = require("knex");
const { Model } = require("objection");
const { default: knexTinyLogger } = require("knex-tiny-logger");
const knexConfig = require("../../knexfile");
const logger = require("../logger");

const knex = Knex(knexConfig.development);
knexTinyLogger(knex, { logger: (...args) => logger.debug(...args) });

Model.knex(knex);

class Base extends Model {}

module.exports = {
  Base,
};
