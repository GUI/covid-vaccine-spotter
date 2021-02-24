const _ = require("lodash");
const sleep = require("sleep-promise");
const { DateTime, Settings } = require("luxon");
const got = require("got");
const cheerio = require("cheerio");
const getDatabase = require("../getDatabase");
const { Store } = require("../models/Store");

module.exports.refreshWalmartStores = async () => {
  await Store.query()
    .where("brand", "walmart")
    .update({
      carries_vaccine: Store.raw(
        "(metadata_raw->'servicesMap'->'COVID_IMMUNIZATIONS'->'active')::boolean"
      ),
      time_zone: Store.raw("metadata_raw->>'timeZone'"),
    });
};

module.exports.refreshWalmartStores();
