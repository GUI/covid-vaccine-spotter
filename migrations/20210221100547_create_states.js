exports.up = function (knex) {
  return knex.schema
    .createTable("states", (table) => {
      table.increments("id").primary();
      table.string("country_code", 2).notNullable();
      table.string("code", 2).notNullable().unique();
      table.string("name").notNullable();
      table.timestamps(false, true);
    })
    .then(async () => {
      await knex.raw(`CREATE OR REPLACE FUNCTION update_timestamp() RETURNS trigger
          LANGUAGE plpgsql
          AS $$
            BEGIN
              -- Detect changes using *<> operator which is compatible with "point"
              -- types that "DISTINCT FROM" is not:
              -- https://www.mail-archive.com/pgsql-general@postgresql.org/msg198866.html
              -- https://www.postgresql.org/docs/10/functions-comparisons.html#COMPOSITE-TYPE-COMPARISON
              IF NEW *<> OLD THEN
                NEW.updated_at := transaction_timestamp();
              END IF;

              RETURN NEW;
            END;
            $$`);
      await knex.raw(
        "CREATE TRIGGER states_updated_at BEFORE UPDATE ON states FOR EACH ROW EXECUTE PROCEDURE update_timestamp()"
      );
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists("states")
    .then(async () => knex.raw("DROP FUNCTION IF EXISTS update_timestamp"));
};
