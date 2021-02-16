const { Table, Entity } = require('dynamodb-toolbox')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const DocumentClient = new DynamoDB.DocumentClient()

// Instantiate a table
const VaccineTable = new Table({
  name: 'vaccine',

  // Define partition and sort keys
  partitionKey: 'pk',
  sortKey: 'sk',

  // Add the DocumentClient
  DocumentClient
})

module.exports = VaccineTable
