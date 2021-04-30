exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.jsonb("location_raw");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("location_raw");
  });
};
