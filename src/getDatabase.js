require("dotenv").config();
const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.DB_ENDPOINT;
const key = process.env.DB_KEY;
const client = new CosmosClient({ endpoint, key });

module.exports = async function albertsonsAuth() {
  const { database } = await client.databases.createIfNotExists({
    id: "vaccine",
  });

  return database;
};
