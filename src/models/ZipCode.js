const { Entity } = require('dynamodb-toolbox')
const VaccineTable = require('./VaccineTable')

const ZipCode = new Entity({
  table: VaccineTable,
  name: 'ZipCode',
  attributes: {
    id: { partitionKey: true },
    sk: { hidden: true, sortKey: true },
    countryCode: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    stateCode: { type: 'string' },
    county: { type: 'string' },
    countyCode: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },

  },
})

module.exports = ZipCode;
