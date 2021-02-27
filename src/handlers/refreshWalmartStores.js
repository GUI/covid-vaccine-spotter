const _ = require('lodash');
const sleep = require('sleep-promise');
const { DateTime, Settings } = require('luxon');
const got = require('got');
const cheerio = require('cheerio');
const getDatabase = require('../getDatabase');
const { Store } = require('../models/Store');

module.exports.refreshWalmartStores = async () => {
  await Store.query()
    .where('brand', 'walmart')
    .update({
      carries_vaccine: Store.raw(
        "(metadata_raw->'servicesMap'->'COVID_IMMUNIZATIONS'->'active')::boolean"
      ),
      time_zone: Store.raw("metadata_raw->>'timeZone'"),
    });

  // This Phenix, AL store's data say it's in the Central time zone, but it
  // actually uses Eastern time zone, so fix this or else requests for the next
  // day will fail for an hour every night (since we're requesting the previous
  // day). https://en.wikipedia.org/wiki/Phenix_City,_Alabama#Time_zone
  await Store.query()
    .where('brand', 'walmart')
    .where('brand_id', '1284')
    .update({
      time_zone: 'America/New_York',
    });
};

module.exports.refreshWalmartStores();
