const _ = require("lodash");
const { curly } = require("node-libcurl");
const cheerio = require("cheerio");
const logger = require("../../logger");
const throwCurlResponseError = require("../../utils/throwCurlResponseError");
const defaultCurlOpts = require("../../utils/defaultCurlOpts");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const { Store } = require("../../models/Store");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");
const setComputedStoreValues = require("../../setComputedStoreValues");

class Stores {
  static async findStores() {
    await Provider.query()
      .insert({
        id: "kta_super_stores",
      })
      .onConflict(["id"])
      .merge();

    Stores.providerBrand = await ProviderBrand.query()
      .insert({
        provider_id: "kta_super_stores",
        key: "kta_super_stores",
        name: "KTA Super Stores",
        url: "https://www.ktasuperstores.com/covid-19-vaccinations",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const resp = throwCurlResponseError(
      await curly.get(
        "https://www.ktasuperstores.com/maps-api/get",
        defaultCurlOpts
      )
    );

    const count = Object.keys(resp.data.store).length;
    let index = 0;
    for (const [storeId, store] of Object.entries(resp.data.store)) {
      index += 1;

      if (!store.field_pharm) {
        logger.info(
          `Skipping store without pharmacy ${store.name} #${storeId} (${index} of ${count})`
        );
        continue;
      }

      logger.info(
        `Importing store ${store.name} #${storeId} (${index} of ${count})`
      );

      let state;
      switch (store.field_state) {
        case "Hawaii":
          state = "HI";
          break;
        default:
          state = store.field_state;
          break;
      }

      const patch = {
        provider_id: "kta_super_stores",
        provider_location_id: storeId,
        provider_brand_id: Stores.providerBrand.id,
        name: store.name,
        address: _.trim(
          [
            store.field_street_address_line_1,
            store.field_street_address_line_2,
          ].join(" ")
        ),
        city: store.field_city,
        state,
        postal_code: store.field_zip_code,
        location: `point(${store.field_store_longitude} ${store.field_store_latitude})`,
        location_source: "provider",
        metadata_raw: {
          store,
        },
        active: true,
      };
      setComputedStoreValues(patch);

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge({
          ..._.omit(patch, ["metadata_raw"]),
          metadata_raw: Store.raw(
            "stores.metadata_raw || excluded.metadata_raw"
          ),
        });
    }

    const patches = [
      {
        provider_id: "kta_super_stores",
        provider_location_id: "big-island-docs-670-ponahawai-st-hilo",
        provider_brand_id: Stores.providerBrand.id,
        name: "Big Island Docs",
        address: "670 Ponahawai St",
        city: "Hilo",
        state: "HI",
        postal_code: "96720",
        location: `point(-155.096369 19.71396)`,
        location_source: "geocodio",
        metadata_raw: {},
        active: true,
      },
      {
        provider_id: "kta_super_stores",
        provider_location_id: "prince-kuhio-plaza-111-e-puainako-st",
        provider_brand_id: Stores.providerBrand.id,
        name: "Prince Kuhio Plaza",
        address: "111 E Puainako St, Ste 655",
        city: "Hilo",
        state: "HI",
        postal_code: "96720",
        location: `point(-155.064641 19.695342)`,
        location_source: "geocodio",
        metadata_raw: {},
        active: true,
      },
    ];
    for (const patch of patches) {
      setComputedStoreValues(patch);

      await Store.query()
        .insert(patch)
        .onConflict(["provider_id", "provider_location_id"])
        .merge({
          ..._.omit(patch, ["metadata_raw"]),
          metadata_raw: Store.raw(
            "stores.metadata_raw || excluded.metadata_raw"
          ),
        });
    }

    const vaccineResp = throwCurlResponseError(
      await curly.get(
        "https://www.ktasuperstores.com/covid-19-vaccinations",
        defaultCurlOpts
      )
    );
    const $body = cheerio.load(vaccineResp.data);
    const storeHeaders = $body("#block-kta-content .column h3");
    for (const storeHeader of storeHeaders) {
      const $storeHeader = $body(storeHeader);
      let $headerElement = $storeHeader;

      const parentElements = $body(storeHeader).parentsUntil(".column > div");
      if (parentElements.length > 0) {
        $headerElement = $body(parentElements[parentElements.length - 1]);
      }

      let storeHtml = "";
      const storeElements = $headerElement.nextUntil("h3, *:has(h3)").addBack();
      for (const storeElement of storeElements) {
        storeHtml += $body.html(storeElement);
      }

      const $storeContent = cheerio.load(storeHtml);
      const storeText = $storeContent.text();

      let providerLocationId;
      if (
        storeText.includes("KTA Puainako") ||
        storeText.includes("50 East Puainako")
      ) {
        providerLocationId = "44";
      } else if (
        storeText.includes("KTA Waimea") ||
        storeText.includes("1158 Mamalahoa")
      ) {
        providerLocationId = "43";
      } else if (
        storeText.includes("KTA Waikoloa") ||
        storeText.includes("3916 Paniolo")
      ) {
        providerLocationId = "16";
      } else if (
        storeText.includes("KTA Keauhou") ||
        storeText.includes("6831 Ali")
      ) {
        providerLocationId = "41";
      } else if (
        storeText.includes("Big Island Docs") ||
        storeText.includes("670 Ponahawai")
      ) {
        providerLocationId = "big-island-docs-670-ponahawai-st-hilo";
      } else if (
        storeText.includes("Prince Kuhio Plaza") ||
        storeText.includes("Pier 1")
      ) {
        providerLocationId = "prince-kuhio-plaza-111-e-puainako-st";
      } else {
        logger.error(
          `Cannot find location ID for store: ${$storeHeader.text()}`
        );
      }

      const metadata = {
        jotform: [],
      };

      const links = $storeContent("a[href*='jotform.com']");
      for (const link of links) {
        const $link = $storeContent(link);

        const url = _.trim($link.attr("href"));
        const formId = url.match(/jotform.com\/(\d+)/)[1];

        const linkText = $link.text();
        let vaccineTypes = normalizedVaccineTypes(linkText);
        if (vaccineTypes.length === 0) {
          vaccineTypes = normalizedVaccineTypes($storeContent.text());
        }

        if (vaccineTypes.length === 0) {
          logger.warn(
            `No vaccine type detected for link: ${url} ${JSON.stringify(
              vaccineTypes
            )}`
          );
        } else if (vaccineTypes.length > 1) {
          logger.warn(
            `More than 1 vaccine type detected for link: ${url} ${JSON.stringify(
              vaccineTypes
            )}`
          );
        }

        metadata.jotform.push({
          url,
          form_id: formId,
          vaccine_types: vaccineTypes,
        });
      }

      await Store.query()
        .findOne({
          provider_id: "kta_super_stores",
          provider_location_id: providerLocationId,
        })
        .patch({
          metadata_raw: Store.raw(
            "(metadata_raw || ?::jsonb)",
            JSON.stringify(metadata)
          ),
        });
    }

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.provider_id = 'kta_super_stores'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().destroy();
  }
}

module.exports = Stores;
