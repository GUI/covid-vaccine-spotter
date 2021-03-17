const parser = require("parse-address");
const _ = require("lodash");

const keys = [
  "number",
  "prefix",
  "street",
  "type",
  "suffix",
  "prefix1",
  "street1",
  "type1",
  "suffix1",
  "prefix2",
  "street2",
  "type2",
  "suffix2",
  "sec_unit_type",
  "sec_unit_num",
  "city",
  "state",
  "zip",
];

module.exports = (address) => {
  const parsed = parser.parseLocation(address);
  let normalized = "";
  for (const key of keys) {
    if (parsed[key]) {
      normalized += ` ${parsed[key]}`;
    }
  }

  normalized = _.trim(normalized.toLowerCase().replace(/[^A-Za-z0-9\-\s]/g, ""))
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
  return normalized;
};
