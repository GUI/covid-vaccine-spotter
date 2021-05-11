/* eslint no-underscore-dangle: ["error", { "allow": ["_plugin"] }] */

const { default: PQueue } = require("p-queue");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const EnlivenHealthAppointments = require("../EnlivenHealth/Appointments");

const normalizedAddressMapping = {
  "6660-fourth-section-rd-brockport-ny-14420":
    "6660-4th-section-rd-brockport-ny-14420",
  "7954-brewerton-rd-cicero-ny-13039": "7952-brewerton-rd-cicero-ny-13039",
  "5885-circle-dr-e-cicero-ny-13039": "7952-brewerton-rd-cicero-ny-13039",
  "3325-w-genesee-st-geddes-ny-13219": "3325-w-genesee-st-syracuse-ny-13219",
  "851-fairport-rd-east-rochester-ny-14445":
    "fairport-marsh-rds-east-rochester-ny-14445",
  "4276-lakeville-rd-geneseo-ny-14454":
    "4287-genesee-valley-plz-geneseo-ny-14454",
  "3953-route-31-liverpool-ny-13090": "3955-route-31-liverpool-ny-13090",
  "1000-hwy-36-n-hornell-ny-14843": "1000-highway-36-n-hornell-ny-14843",
  "500-s-meadow-dr-ithaca-ny-14850": "500-s-meadow-st-ithaca-ny-14850",
  "s-3740-mckinley-pkwy": "3740-mckinley-pkwy-buffalo-ny-14219",
  "3737-mt-read-blvd-rochester-ny-14616":
    "3701-mt-read-blvd-rochester-ny-14616",
  "miller-st-finch-st-newark-ny-14513": "800-w-miller-st-newark-ny-14513",
  "2155-penfield-rd-penfield-ny-14526": "2157-penfield-rd-penfield-ny-14526",
  "wegmans-conference-center-200-market-st-rochester-ny-14624":
    "200-wegmans-market-st-rochester-ny-14624",
  "122-shawan-rd-baltimore-md-21030": "122-shawan-rd-hunt-valley-md-21030",
  "100-farmview-montvale-nj-07645": "100-farm-vw-montvale-nj-07645",
  "32-sylvan-way-parsippany-nj-07054": "34-sylvan-way-hanover-nj-07054",
  "1104-highway-35-ocean-nj-07712": "1104-highway-35-s-ocean-nj-07712",
  "201-williams-st-williamsport-pa-17701":
    "201-william-st-williamsport-pa-17701",
  "345-lowes-blvd-state-college-pa-16803":
    "345-colonnade-blvd-state-college-pa-16803",
  "1315-scranton-carbondale-hwy-scranton-city-pa-18508":
    "1315-cold-spring-rd-scranton-pa-18508",
  "w-dekalb-pike-warner-rd-king-of-prussia-pa-19406":
    "1-village-dr-king-of-prussia-pa-19406",
  "100-applied-bank-blvd-concordville-pa-19342":
    "100-applied-bank-blvd-glen-mills-pa-19342",
  "2833-ridge-rd-w": "2833-ridge-rd-w-rochester-ny-14626",
  "3701-mt-read-blvd": "3701-mt-read-blvd-rochester-ny-14616",
  "s-3740-mckinley-pkwy-blasdell-ny-14219":
    "3740-mckinley-pkwy-buffalo-ny-14219",
  "101-crosstrail-blvd": "101-crosstrail-blvd-se-leesburg-va-20175",
};

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    EnlivenHealthAppointments.setup(Appointments);

    const stores = await Store.query()
      .where("stores.provider_id", "wegmans")
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() =>
        EnlivenHealthAppointments.refreshStore(
          Appointments,
          store,
          index,
          stores.length
        )
      );
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  }

  static getSocketUrlId(store) {
    let urlId;
    switch (store.state) {
      case "MA":
        urlId = "48edc95a9b564cffbc91529fa5767232";
        break;
      case "MD":
        urlId = "ab695d256ce244ad93c7cc2ade6680e2";
        break;
      case "NJ":
        urlId = "2f0f142785b8413a85b4bfcf01ca6d35";
        break;
      case "NY":
        urlId = "c7f2e9cb1982412bb53430a84dfd72ad";
        break;
      case "PA":
        urlId = "15f5aede2e3b479b94e35e63c19473dd";
        break;
      case "VA":
        urlId = "a0cdfb37d60d4a85ab01641d82efc1dc";
        break;
      default:
        break;
    }

    return urlId;
  }

  static getNormalizedAddress(normalizedAddress) {
    const mapped = normalizedAddressMapping[normalizedAddress];
    return mapped || normalizedAddress;
  }
}

module.exports = Appointments;
