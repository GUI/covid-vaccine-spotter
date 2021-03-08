const got = require("got");
const sleep = require("sleep-promise");
const logger = require("../../logger");
const { Store } = require("../../models/Store");
const { ProviderBrand } = require("../../models/ProviderBrand");

const PharmacaStores = {
  findStores: async () => {
    const providerBrand = await ProviderBrand.query().findOne({ provider_id: "pharmaca" });

    const resp = await got.post(
      "https://www.pharmacarx.com/wp-admin/admin-ajax.php",
      {
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        },
        form: {
          action: "csl_ajax_onload",
          address: "",
          formdata: "addressInput=",
          lat: "37.09024",
          lng: "-95.712891",
          "options[distance_unit]": "miles",
          "options[dropdown_style]": "none",
          "options[ignore_radius]": "0",
          "options[immediately_show_locations]": "1",
          "options[initial_radius]": "",
          "options[label_directions]": "Directions",
          "options[label_email]": "Email",
          "options[label_fax]": "Fax",
          "options[label_phone]": "Phone",
          "options[label_website]": "Store Info & Schedule Immunization",
          "options[loading_indicator]": "",
          "options[map_center]": "United States",
          "options[map_center_lat]": "37.09024",
          "options[map_center_lng]": "-95.712891",
          "options[map_domain]": "maps.google.com",
          "options[map_end_icon]":
            "https://www.pharmacarx.net/wp-content/plugins/store-locator-le/images/icons/bulb_azure.png",
          "options[map_home_icon]":
            "https://www.pharmacarx.net/wp-content/plugins/store-locator-le/images/icons/bulb_yellow.png",
          "options[map_region]": "us",
          "options[map_type]": "roadmap",
          "options[no_autozoom]": "0",
          "options[use_sensor]": "false",
          "options[zoom_level]": "12",
          "options[zoom_tweak]": "0",
          radius: "",
        },
        responseType: "json",
        timeout: 30000,
        retry: 0,
      }
    );

    for (const store of resp.body.response) {
      logger.info(`Importing store ${store.name}`);

      if (store.name.includes("CLOSED")) {
        logger.info(`Skipping closed store: ${store.name}`);
        continue;
      }

      let webLink = store.web_link.match(/href=['"]([^'"]+)/)[1];
      if (webLink.startsWith("/")) {
        webLink = `https://www.pharmacarx.com/${webLink}`;
      }

      const webResp = await got(webLink, {
        headers: {
          "User-Agent":
            "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
        },
      });

      const scheduleUrlId = webResp.body.match(/pharmaca.as.me\/([^'"]+)/)[1];

      let state;
      switch (store.state) {
        case "Colorado":
          state = "CO";
          break;
        case "Illinois":
          state = "IL";
          break;
        case "New Mexico":
          state = "NM";
          break;
        case "California":
          state = "CA";
          break;
        case "Oregon":
          state = "OR";
          break;
        case "Washington":
          state = "WA";
          break;
        default:
          state = store.state;
          break;
      }

      await Store.query()
        .insert({
          brand: "pharmaca",
          brand_id: store.id,
          provider_id: "pharmaca",
          provider_location_id: store.id,
          provider_brand_id: providerBrand.id,
          name: store.name,
          address: store.address,
          city: store.city,
          state,
          postal_code: store.zip,
          location: `point(${store.lng} ${store.lat})`,
          location_source: "provider",
          url: `https://pharmaca.as.me/${scheduleUrlId}`,
          metadata_raw: {
            store,
            schedule_url_id: scheduleUrlId,
          },
        })
        .onConflict(["brand", "brand_id"])
        .merge();

      await sleep(1000);
    }

    await Store.knex().raw(`
      UPDATE stores s
      SET time_zone = p.time_zone
      FROM postal_codes p
      WHERE
        s.brand = 'pharmaca'
        AND s.time_zone IS NULL
        AND s.postal_code = p.postal_code
    `);

    await Store.knex().destroy();
  },
};

module.exports = PharmacaStores;
