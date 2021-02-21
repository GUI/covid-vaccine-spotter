const { Entity } = require("dynamodb-toolbox");
const VaccineTable = require("./VaccineTable");

const KrogerStore = new Entity({
  table: VaccineTable,
  name: "KrogerStore",
  attributes: {
    id: { partitionKey: true },
    sk: { hidden: true, sortKey: true },
  },
});

module.exports = KrogerStore;
