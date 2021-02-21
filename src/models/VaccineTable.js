const { Table } = require("dynamodb-toolbox");
const DynamoDB = require("aws-sdk/clients/dynamodb");
const DocumentClient = new DynamoDB.DocumentClient({
  region: "us-east-2",
});

// Instantiate a table
const VaccineTable = new Table({
  name: "vaccine",

  partitionKey: "pk",
  sortKey: "sk",

  DocumentClient,
});

module.exports = VaccineTable;
