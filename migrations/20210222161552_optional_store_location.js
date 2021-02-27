exports.up = function (knex) {
  return knex.schema.alterTable('stores', (table) => {
    table.specificType('location', 'geography(point, 4326)').alter();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('stores', (table) => {
    table
      .specificType('location', 'geography(point, 4326)')
      .notNullable()
      .alter();
  });
};
