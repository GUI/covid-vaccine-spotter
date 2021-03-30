exports.up = async function (knex) {
  await knex.schema.table("states", (table) => {
    table.specificType("boundaries_500k", "geography(multipolygon, 4326)");
    table.specificType("boundaries_5m", "geography(multipolygon, 4326)");
    table.index("boundaries_500k", null, "gist");
    table.index("boundaries_5m", null, "gist");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("states", (table) => {
    table.dropColumn("boundaries_500k");
  });
};
