const Knex = require("knex");
const { Model } = require("objection");
const knexConfig = require("../../knexfile");

const knex = Knex(knexConfig.development);

Model.knex(knex);

class Base extends Model {}

module.exports = {
  Base,
};
