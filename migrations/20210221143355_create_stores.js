exports.up = function (knex) {
  return knex.schema
    .createTable("stores", (table) => {
      table.increments("id").primary();
      table.string("brand").notNullable();
      table.string("brand_id").notNullable();
      table.string("name");
      table.string("address");
      table.string("city").notNullable();
      table.string("state").notNullable().references("code").inTable("states");
      table
        .string("postal_code")
        .references("postal_code")
        .inTable("postal_codes");
      table.specificType("location", "geography(point, 4326)").notNullable();
      table.jsonb("metadata_raw");
      table.jsonb("appointments");
      table.boolean("appointments_available").index();
      table.datetime("appointments_last_fetched").index();
      table.jsonb("appointments_raw");
      table.timestamps(false, true);
      table.unique(["brand", "brand_id"]);
    })
    .then(() =>
      knex.raw(
        "CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE PROCEDURE update_timestamp()"
      )
    );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("stores");
};
