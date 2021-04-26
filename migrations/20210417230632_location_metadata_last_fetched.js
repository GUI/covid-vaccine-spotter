exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.datetime("location_metadata_last_fetched");
  });

  await knex.raw("DROP TRIGGER audit_trigger_row ON stores");
  await knex.raw(
    "CREATE TRIGGER audit_trigger_row AFTER INSERT OR DELETE OR UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func('false', '{created_at,updated_at,metadata_raw,appointments_raw,appointments_last_fetched,appointments_last_modified,location_metadata_last_fetched}')"
  );
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("location_metadata_last_fetched");
  });

  await knex.raw("DROP TRIGGER audit_trigger_row ON stores");
  await knex.raw(
    "CREATE TRIGGER audit_trigger_row AFTER INSERT OR DELETE OR UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func('false', '{created_at,updated_at,metadata_raw,appointments_raw,appointments_last_fetched}')"
  );
};
