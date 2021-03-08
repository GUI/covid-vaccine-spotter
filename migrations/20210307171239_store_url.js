exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.string("url");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("url");
  });
};
