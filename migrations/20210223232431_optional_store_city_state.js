exports.up = async function (knex) {
  await knex.schema.alterTable("stores", (table) => {
    table.string("city").alter();
    table.string("state").alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("stores", (table) => {
    table.string("city").notNullable().alter();
    table.string("state").notNullable().alter();
  });
};
