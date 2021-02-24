exports.up = function (knex) {
  return knex.schema
    .raw("CREATE EXTENSION IF NOT EXISTS postgis")
    .createTable("postal_codes", (table) => {
      table.increments("id").primary();
      table
        .string("state_code", 2)
        .references("code")
        .inTable("states")
        .notNullable();
      table.string("postal_code", 5).unique().notNullable();
      table.string("city").notNullable();
      table.string("county_name").notNullable();
      table.string("county_code");
      table.specificType("location", "geography(point, 4326)").notNullable();
      table.timestamps(false, true);
    })
    .then(async () =>
      knex.raw(
        "CREATE TRIGGER postal_codes_updated_at BEFORE UPDATE ON postal_codes FOR EACH ROW EXECUTE PROCEDURE update_timestamp()"
      )
    );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("postal_codes");
};
