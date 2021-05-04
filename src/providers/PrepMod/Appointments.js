const sleep = require("sleep-promise");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const cheerio = require("cheerio");
const logger = require("../../logger");
const setComputedStoreValues = require("../../setComputedStoreValues");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const normalizedAddressKey = require("../../normalizedAddressKey");
const { Store } = require("../../models/Store");
const { PostalCode } = require("../../models/PostalCode");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static refreshStores(provider_id, url) {
    return async function () {
      logger.notice(`Begin refreshing appointments for all stores in ${provider_id}...`);

      const search_url = `${url}/clinic/search`;

      await Provider.query()
        .insert({
          id: provider_id,
        })
        .onConflict(["id"])
        .merge();

      await ProviderBrand.query()
        .insert({
          provider_id: provider_id,
          key: provider_id,
          name: "PrepMod",
          url: search_url,
        })
        .onConflict(["provider_id", "key"])
        .merge();
      Appointments.providerBrand = await ProviderBrand.query().findOne({
        provider_id: provider_id,
        key: provider_id,
      });

      Appointments.patches = {};

      let pageNum = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        const lastFetched = DateTime.utc().toISO();
        const pageResp = await Appointments.fetchSearchPage(search_url, pageNum);
        hasNextPage = await Appointments.processSearchPage(
          provider_id,
          url,
          pageNum,
          pageResp,
          lastFetched
        );

        pageNum += 1;
      }

      for (const patch of Object.values(Appointments.patches)) {
        patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);
        setComputedStoreValues(patch);

        await Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge();
      }

      logger.notice("Finished refreshing appointments for all stores.");
    }
  }

  static async fetchSearchPage(url, pageNum) {
    logger.info(`Fetching page ${pageNum} of search results`);
    await sleep(_.random(250, 750));
    const searchParams = new URLSearchParams([
      ["q[services_name_in][]", "covid"],
      ["q[services_name_in][]", "Vaccination"],
      ["page", pageNum]
    ]);
    return got(url, {
      searchParams,
      headers: {
        "User-Agent": "VaccineSpotter.org",
      },
      timeout: 30000,
      retry: 0,
    });
  }

  static async processSearchPage(provider_id, url, pageNum, resp, lastFetched) {
    const $page = cheerio.load(resp.body);
    const searchResults = $page(".md\\:flex-shrink:has(.text-xl)");
    for (const searchResult of searchResults) {
      const $searchResult = $page(searchResult);

      const pTags = $searchResult.find("p");

      const addressParts = _.trim($page(pTags[1]).text()).split(/\s*,\s*/);
      const cityStateParts = _.nth(addressParts, -2).match(/^(.+)\s+(\w+)$/);

      const address = addressParts[0].replace(/\([^)]+\)/, "");
      const city = cityStateParts[1];
      let state = cityStateParts[2];
      if (state === "Colorado") {
        state = "CO";
      }
      const postalCode = _.nth(addressParts, -1);
      const providerLocationId = normalizedAddressKey(
        `${address}, ${city}, ${state} ${postalCode}`
      );

      let patch = Appointments.patches[providerLocationId];
      if (!patch) {
        patch = {
          provider_id: provider_id,
          provider_location_id: providerLocationId,
          provider_brand_id: Appointments.providerBrand.id,
          active: true,
          name: _.trim(
            $page(pTags[0])
              .text()
              .replace(/ on [\d/]+/, "")
          ),
          address,
          city,
          state,
          postal_code: postalCode,
          appointments: [],
          appointments_last_fetched: lastFetched,
          appointments_available: false,
        };

        const store = await Store.query().findOne({
          provider_id: patch.provider_id,
          provider_location_id: patch.provider_location_id,
        });

        if (store) {
          patch.time_zone = store.time_zone;
        } else {
          const postalCodeRecord = await PostalCode.query().findOne({
            postal_code: patch.postal_code,
          });

          patch.time_zone = postalCodeRecord.time_zone;
          patch.location = postalCodeRecord.location;
          patch.location_source = "postal_codes";
        }

        Appointments.patches[providerLocationId] = patch;
      }

      let vaccineType = _.trim(
        $searchResult
          .find("p:contains('Vaccinations offered:')")
          .text()
          .replace("Vaccinations offered:", "")
          .replace("COVID-19 Vaccine", "")
      );

      let appointmentType;
      if (
        $searchResult
          .text()
          .match(/(2nd doses?( clinic)? only|second doses?( clinic)? only)/i)
      ) {
        appointmentType = "2nd_dose_only";
        vaccineType = `${vaccineType} - 2nd Dose Only`;
      }

      const signUpLink = $searchResult
        .find("[href*='/client/registration']")
        .attr("href");
      if (signUpLink) {
        const signUpResp = await Appointments.fetchSignUpPage(url, signUpLink);
        const $signUpPage = cheerio.load(signUpResp.body);

        const timeRadios = $signUpPage(
          "input[name='appointment[appointment_at_unix]']:enabled"
        );
        for (const timeRadio of timeRadios) {
          const $timeRadio = $signUpPage(timeRadio);

          const dateText = $timeRadio.attr("data-appointment-date");
          const timeText = $timeRadio.attr("data-appointment-time");
          if (dateText && timeText) {
            patch.appointments.push({
              appointment_types: appointmentType ? [appointmentType] : [],
              vaccine_types: normalizedVaccineTypes(vaccineType),
              type: vaccineType,
              time: DateTime.fromFormat(
                `${dateText} ${timeText}`,
                "LL/dd/yyyy hh:mm a",
                {
                  zone: patch.time_zone,
                }
              ).toISO(),
            });
          }
        }
      }
    }

    const nextLink = $page("nav a[rel=next]").attr("href");
    if (
      nextLink &&
      nextLink.includes("/clinic/search") &&
      !nextLink.includes(`page=${pageNum}`)
    ) {
      return true;
    }
    return false;
  }

  static async fetchSignUpPage(url, link) {
    logger.info(`Fetching sign up page ${link} for appointment slots`);
    await sleep(_.random(250, 750));
    return got(`${url}${link}`, {
      headers: {
        "User-Agent": "VaccineSpotter.org",
      },
      timeout: 30000,
      retry: 0,
    });
  }
}

module.exports = Appointments;
