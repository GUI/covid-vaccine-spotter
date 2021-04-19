exports.up = async function (knex) {
  await knex.schema.table("states", (table) => {
    table.string("fips_code", 2);
    table.unique(["fips_code"]);
  });

  await knex.schema.createTable("counties", (table) => {
    table.increments("id").primary();
    table
      .string("state_code", 2)
      .references("code")
      .inTable("states")
      .notNullable();
    table.string("fips_code", 3).notNullable();
    table.string("name").notNullable();
    table.specificType("boundaries_500k", "geography(multipolygon, 4326)");
    table.unique(["state_code", "fips_code"]);
    table.index("state_code");
    table.index("boundaries_500k", null, "gist");
  });

  await knex.schema.table("stores", (table) => {
    table.integer("county_id").references("id").inTable("counties");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("county_id");
  });

  await knex.schema.dropTable("counties");

  await knex.schema.table("states", (table) => {
    table.dropColumn("fips_code");
  });
};
