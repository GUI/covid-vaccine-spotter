exports.up = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.string("location_source");
    table.index("state");
  });

  await knex.schema.table("states", (table) => {
    table.index("boundaries", null, "gist");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("location_source");
    table.dropIndex("state");
  });

  await knex.schema.table("states", (table) => {
    table.dropIndex("boundaries");
  });
};
