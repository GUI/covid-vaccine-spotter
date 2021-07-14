const got = require("got");
const SmartSchedulingLinks = require("../../utils/SmartSchedulingLinks");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static async getTokenResponse() {
    return got.post("https://api.kroger.com/v1/connect/oauth2/token", {
      headers: {
        "User-Agent": "VaccineSpotter.org",
      },
      username: process.env.KROGER_CLIENT_ID,
      password: process.env.KROGER_CLIENT_SECRET,
      responseType: "json",
      form: {
        grant_type: "client_credentials",
        scope: "urn:com:kroger:hw:schedules:vaccines:read",
      },
      timeout: 30000,
      retry: 0,
    });
  }

  static async refreshStores() {
    const tokenResponse = await Appointments.getTokenResponse();

    const providerBrands = await ProviderBrand.query().where({
      provider_id: "kroger",
    });
    const providerBrandsByKey = {};
    for (const providerBrand of providerBrands) {
      providerBrandsByKey[providerBrand.key] = providerBrand;
    }

    await SmartSchedulingLinks.processManifest(
      {
        provider_id: "kroger",
        key: "kroger",
        name: "Kroger",
        url: "https://www.kroger.com/rx/covid-eligibility",
      },
      "https://api.kroger.com/v1/health-wellness/schedules/vaccines/$bulk-publish",
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.body.access_token}`,
        },
        providerBrandsByKey,
      }
    );
  }
}

module.exports = Appointments;
