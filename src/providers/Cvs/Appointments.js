const SmartSchedulingLinks = require("../../utils/SmartSchedulingLinks");

class Appointments {
  static async refreshStores() {
    await SmartSchedulingLinks.processManifest(
      {
        provider_id: "cvs",
        key: "cvs",
        name: "CVS",
        url: "https://www.cvs.com/vaccine/intake/store/cvd-schedule",
      },
      "https://www.cvs.com/immunizations/inventory/data/$bulk-publish"
    );
  }
}

module.exports = Appointments;
