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
  let addressString = address;
  if (_.isObjectLike(address)) {
    const addressParts = [];
    if (address.address) {
      addressParts.push(address.address.replace(/,/g, ""));
    }

    if (address.city) {
      addressParts.push(address.city.replace(/,/g, ""));
    }

    if (address.state) {
      addressParts.push(address.state.replace(/,/g, ""));
    }

    if (address.postal_code) {
      addressParts.push(
        _.trim(address.postal_code).replace(/,/g, "").substr(0, 5)
      );
    }

    addressString = addressParts.join(", ");
  }

  const parsed = parser.parseLocation(addressString);
  let normalized = "";
  if (parsed) {
    for (const key of keys) {
      if (parsed[key]) {
        normalized += ` ${parsed[key]}`;
      }
    }
  } else {
    normalized = addressString;
  }

  normalized = _.trim(normalized.toLowerCase().replace(/[^A-Za-z0-9\-\s]/g, ""))
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized;
};
