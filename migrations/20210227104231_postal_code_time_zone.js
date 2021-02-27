exports.up = async function (knex) {
  await knex.schema.table('postal_codes', (table) => {
    table.string('time_zone');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('postal_codes', (table) => {
    table.dropColumn('time_zone');
  });
};
