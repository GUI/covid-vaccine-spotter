exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.string("time_zone");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("time_zone");
  });
};
