exports.up = async function (knex) {
  await knex.schema.createTable("cache", (table) => {
    table.string("id").primary();
    table.jsonb("value");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("cache");
};
