exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.datetime("appointments_last_modified");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("appointments_last_modified");
  });
};
