const _ = require("lodash");
const { default: PQueue } = require("p-queue");
const got = require("got");
const { DateTime } = require("luxon");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static async fetchAvailability() {
    return got(
      "https://s3-us-west-2.amazonaws.com/mhc.cdn.content/vaccineAvailability.json",
      {
        searchParams: {
          v: _.random(0, 999999999999),
        },
        headers: {
          "User-Agent": "VaccineSpotter.org",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    );
  }

  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    await Provider.query()
      .insert({
        id: "albertsons",
      })
      .onConflict(["id"])
      .merge();

    const providerBrands = {};
    const providerBrandsData = [
      {
        provider_id: "albertsons",
        key: "acme",
        name: "Acme",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "albertsons",
        name: "Albertsons",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "albertsons_market",
        name: "Albertsons Market",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "amigos",
        name: "Amigos",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "carrs",
        name: "Carrs",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "haggen",
        name: "Haggen",
        url:
          "https://www.haggen.com/explore-our-departments/pharmacy/covid-19/",
      },
      {
        provider_id: "albertsons",
        key: "jewelosco",
        name: "Jewel-Osco",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "luckys",
        name: "Lucky",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "market_street",
        name: "Market Street",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "pak_n_save",
        name: "Pak 'n Save",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "pavilions",
        name: "Pavilions",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "randalls",
        name: "Randalls",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "randalls_pharmacy",
        name: "Randalls Pharmacy",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "safeway",
        name: "Safeway",
        url: "https://www.safeway.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "shaws",
        name: "Shaw's",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "star_market",
        name: "Star Market",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "tom_thumb",
        name: "Tom Thumb",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "united",
        name: "United Supermarkets",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
      {
        provider_id: "albertsons",
        key: "vons",
        name: "Vons",
        url: "https://www.albertsons.com/pharmacy/covid-19.html",
      },
    ];
    for (const providerBrandData of providerBrandsData) {
      providerBrands[
        providerBrandData.key
      ] = await ProviderBrand.query()
        .insert(providerBrandData)
        .onConflict(["provider_id", "key"])
        .merge();
    }

    const queue = new PQueue({ concurrency: 10 });

    const lastFetched = DateTime.utc().toISO();
    const resp = await Appointments.fetchAvailability();
    const lastModified = DateTime.fromHTTP(
      resp.headers["last-modified"]
    ).toISO();
    for (const store of resp.body) {
      queue.add(async () => {
        const addressParts = store.address.split(/\s+-\s+/);
        const name = addressParts[0];
        const addressMatches = addressParts
          .slice(1)
          .join(" - ")
          .match(/\s*(.+?),\s+(.+?),\s+([A-Z]{2}),\s+([0-9-]+)\s*$/i);

        let providerBrand;
        if (name.match(/Acme/i)) {
          providerBrand = providerBrands.acme;
        } else if (name.match(/Albertsons Market/i)) {
          providerBrand = providerBrands.albertsons_market;
        } else if (name.match(/Albertsons/i)) {
          providerBrand = providerBrands.albertsons;
        } else if (name.match(/Amigos/i)) {
          providerBrand = providerBrands.amigos;
        } else if (name.match(/Carrs/i)) {
          providerBrand = providerBrands.carrs;
        } else if (name.match(/Haggen/i)) {
          providerBrand = providerBrands.haggen;
        } else if (name.match(/Jewel.Osco/i)) {
          providerBrand = providerBrands.jewelosco;
        } else if (name.match(/Lucky/i)) {
          providerBrand = providerBrands.lucky;
        } else if (name.match(/Market Street/i)) {
          providerBrand = providerBrands.market_street;
        } else if (name.match(/Pak N Save/i)) {
          providerBrand = providerBrands.pak_n_save;
        } else if (name.match(/Pavilions/i)) {
          providerBrand = providerBrands.pavilions;
        } else if (name.match(/Randalls Pharmacy/i)) {
          providerBrand = providerBrands.randalls_pharmacy;
        } else if (name.match(/Randalls/i)) {
          providerBrand = providerBrands.randalls;
        } else if (name.match(/Safeway/i)) {
          providerBrand = providerBrands.safeway;
        } else if (name.match(/Shaw/i)) {
          providerBrand = providerBrands.shaws;
        } else if (name.match(/Star Market/i)) {
          providerBrand = providerBrands.star_market;
        } else if (name.match(/Tom Thumb/i)) {
          providerBrand = providerBrands.tom_thumb;
        } else if (name.match(/United/i)) {
          providerBrand = providerBrands.united;
        } else if (name.match(/Vons/i)) {
          providerBrand = providerBrands.vons;
        }

        if (!providerBrand) {
          logger.error(
            `Could not determine provider brand: ${name} ${JSON.stringify(
              store
            )}`
          );
          return;
        }

        const patch = {
          provider_id: "albertsons",
          provider_location_id: store.id,
          provider_brand_id: providerBrand.id,
          name,
          address: addressMatches[1],
          city: addressMatches[2],
          state: addressMatches[3].toUpperCase(),
          postal_code: addressMatches[4].substr(0, 5),
          location: `point(${store.long} ${store.lat})`,
          location_source: "provider",
          appointments: [],
          appointments_last_fetched: lastFetched,
          appointments_last_modified: lastModified,
          appointments_available: store.availability === "yes",
          appointments_raw: {
            availability: store,
            headers: resp.headers,
          },
        };
        setComputedStoreValues(patch);

        await Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge();
      });
    }

    await queue.onIdle();

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'albertsons'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().raw(`
      UPDATE stores s
      SET county_id = c.id
      FROM counties c
      WHERE
        s.provider_id = 'albertsons'
        AND s.county_id IS NULL
        AND st_intersects(s.location, c.boundaries_500k)
    `);

    logger.notice("Finished refreshing appointments for all stores.");
  }
}

module.exports = Appointments;
