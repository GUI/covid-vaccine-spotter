exports.up = async function (knex) {
  await knex.schema.table("audit.log", (table) => {
    table.index("action_tstamp_tx");
  });
};

exports.down = async function (knex) {
  await knex.schema.table("audit.log", (table) => {
    table.dropIndex("action_tstamp_tx");
  });
};
