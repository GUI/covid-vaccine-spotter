const got = require("got");
const slug = require("slug");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Stores {
  static async findStores() {
    Stores.importedStores = {};

    await Provider.query()
      .insert({
        id: "kroger",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrandIds = {};

    const knex = Store.knex();
    const grid = await knex
      .select(
        knex.raw(
          "id, centroid_postal_code, st_y(centroid_location::geometry) AS latitude, st_x(centroid_location::geometry) AS longitude"
        )
      )
      .from("country_grid_220km")
      .orderBy("centroid_postal_code");
    const count = grid.length;
    for (const [index, gridCell] of grid.entries()) {
      logger.info(
        `Importing stores for ${gridCell.centroid_postal_code} (${
          gridCell.latitude
        },${gridCell.longitude}) (${index + 1} of ${count})...`
      );

      const resp = await Stores.importStoresInGridCell(gridCell);

      if (resp.body.data.length >= 200) {
        logger.error(
          `There may be more stores within the 100 mile radius than returned, since the maximum of 200 stores was returned: ${gridCell.centroid_postal_code}. Check manually or implement smaller grid search.`
        );
      }
    }

    await Store.knex().destroy();
  }

  static async getTokenResponse() {
    if (!Stores.tokenResponse) {
      Stores.tokenResponse = await got.post(
        "https://api.kroger.com/v1/connect/oauth2/token",
        {
          headers: {
            "User-Agent": "VaccineSpotter.org",
          },
          username: process.env.KROGER_CLIENT_ID,
          password: process.env.KROGER_CLIENT_SECRET,
          responseType: "json",
          form: {
            grant_type: "client_credentials",
          },
          timeout: 30000,
          retry: 0,
        }
      );
    }

    return Stores.tokenResponse;
  }

  static async importStoresInGridCell(gridCell) {
    const tokenResponse = await Stores.getTokenResponse();

    const resp = await got("https://api.kroger.com/v1/locations", {
      searchParams: {
        "filter.lat.near": gridCell.latitude,
        "filter.lon.near": gridCell.longitude,
        "filter.radiusInMiles": 100,
        "filter.limit": 200,
        "filter.department": "09",
      },
      headers: {
        "User-Agent": "VaccineSpotter.org",
        Authorization: `Bearer ${tokenResponse.body.access_token}`,
      },
      responseType: "json",
      timeout: 30000,
      retry: 0,
    });

    for (const store of resp.body.data) {
      const departments = store.departments || [];
      if (Stores.importedStores[store.locationId]) {
        logger.info(`  Skipping already imported store ${store.locationId}`);
      } else if (
        store.chain !== "THE LITTLE CLINIC" &&
        !departments.some((d) => d.departmentId === "09")
      ) {
        logger.info(
          `  Skipping non-pharmacy store ${store.locationId} ${store.name}`
        );
      } else {
        logger.info(`  Importing store ${store.locationId}`);

        let providerBrandId = Stores.providerBrandIds[store.chain];
        if (!providerBrandId) {
          const key = slug(store.chain, "_");
          let name;
          let url;
          switch (key) {
            case "bakers":
              name = "Baker's";
              url = "https://www.bakersplus.com/rx/covid-eligibility";
              break;
            case "citymarket":
              name = "City Market";
              url = "https://www.citymarket.com/rx/covid-eligibility";
              break;
            case "covid":
              name = "Kroger COVID";
              url = "https://www.kroger.com/rx/covid-eligibility";
              break;
            case "dillons":
              name = "Dillons";
              url = "https://www.dillons.com/rx/covid-eligibility";
              break;
            case "fred":
              name = "Fred Meyer";
              url = "https://www.fredmeyer.com/rx/covid-eligibility";
              break;
            case "frys":
              name = "Fry's";
              url = "https://www.frysfood.com/rx/covid-eligibility";
              break;
            case "gerbes":
              name = "Gerbes";
              url = "https://www.gerbes.com/rx/covid-eligibility";
              break;
            case "hart":
              name = "Harris Teeter";
              url = "https://www.harristeeterpharmacy.com/rx/covid-eligibility";
              break;
            case "jayc":
              name = "Jay C";
              url = "https://www.jaycfoods.com/rx/covid-eligibility";
              break;
            case "kingsoopers":
              name = "King Soopers";
              url = "https://www.kingsoopers.com/rx/covid-eligibility";
              break;
            case "kroger":
              name = "Kroger";
              url = "https://www.kroger.com/rx/covid-eligibility";
              break;
            case "marianos":
              name = "Mariano's";
              url = "https://www.marianos.com/rx/covid-eligibility";
              break;
            case "metro_market":
              name = "Metro Market";
              url = "https://www.metromarket.net/rx/covid-eligibility";
              break;
            case "payless":
              name = "Pay-Less";
              url = "https://www.pay-less.com/rx/covid-eligibility";
              break;
            case "pick_n_save":
              name = "Pick 'n Save";
              url = "https://www.picknsave.com/rx/covid-eligibility";
              break;
            case "qfc":
              name = "QFC";
              url = "https://www.qfc.com/rx/covid-eligibility";
              break;
            case "ralphs":
              name = "Ralphs";
              url = "https://www.ralphs.com/rx/covid-eligibility";
              break;
            case "smiths":
              name = "Smith's";
              url = "https://www.smithsfoodanddrug.com/rx/covid-eligibility";
              break;
            default:
              throw new Error(`Unknown brand ${key}`);
          }

          await ProviderBrand.query()
            .insert({
              provider_id: "kroger",
              key,
              name,
              url,
            })
            .onConflict(["provider_id", "key"])
            .merge();

          const providerBrand = await ProviderBrand.query().findOne({
            provider_id: "kroger",
            key,
          });

          providerBrandId = providerBrand.id;
          Stores.providerBrandIds[store.chain] = providerBrandId;
        }

        const patch = {
          provider_id: "kroger",
          provider_location_id: store.locationId,
          provider_brand_id: providerBrandId,
          name: store.name,
          address: store.address.addressLine1,
          city: store.address.city,
          state: store.address.state,
          postal_code: store.address.zipCode,
          location: `point(${store.geolocation.longitude} ${store.geolocation.latitude})`,
          location_source: "provider",
          time_zone: store.hours.timezone,
          metadata_raw: store,
        };
        patch.brand = patch.provider_id;
        patch.brand_id = patch.provider_location_id;

        await Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge();

        Stores.importedStores[store.locationId] = true;
      }
    }

    return resp;
  }
}

module.exports = Stores;
