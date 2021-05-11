/* eslint no-underscore-dangle: ["error", { "allow": ["_plugin"] }] */

const { default: PQueue } = require("p-queue");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const EnlivenHealthAppointments = require("../EnlivenHealth/Appointments");

const normalizedAddressMapping = {};

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    EnlivenHealthAppointments.setup(Appointments);

    const stores = await Store.query()
      .where("stores.provider_id", "weis")
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
    if (store.state === "MD") {
      urlId = "481e810bfc434aa3b1b6b890bfd7e119";
    } else if (store.state === "NY") {
      urlId = "3f647956b456425d9c12360db8e4fdb4";
    } else if (store.state === "NJ") {
      urlId = "a650b502db904b0195d640fd68a4a2a0";
    } else if (store.state === "PA") {
      urlId = "8d8feb6dce7d4d598f753362d06d1e64";
    } else if (store.state === "WV") {
      urlId = "3e89237d284b4540b28caa364829b547";
    }

    return urlId;
  }

  static getNormalizedAddress(normalizedAddress) {
    const mapped = normalizedAddressMapping[normalizedAddress];
    return mapped || normalizedAddress;
  }
}

module.exports = Appointments;
