exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.jsonb("appointment_types");
    table.jsonb("appointment_vaccine_types");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("appointment_types");
    table.dropColumn("appointment_vaccine_types");
  });
};
