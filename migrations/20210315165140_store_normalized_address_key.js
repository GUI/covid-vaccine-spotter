exports.up = async function (knex) {
  await knex.raw("CREATE EXTENSION pg_trgm");
  await knex.schema.table("stores", (table) => {
    table.string("normalized_address_key");
    table.unique(["provider_id", "normalized_address_key"]);
  });
};

exports.down = async function (knex) {
  await knex.raw("DROP EXTENSION pg_trgm");
  await knex.schema.table("stores", (table) => {
    table.dropColumn("normalized_address_key");
  });
};
