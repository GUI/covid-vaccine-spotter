const { default: PQueue } = require("p-queue");
const retry = require("p-retry");
const { DateTime } = require("luxon");
const _ = require("lodash");
const got = require("got");
const parseAddress = require("parse-address");
const logger = require("../../logger");
const normalizedVaccineTypes = require("../../normalizedVaccineTypes");
const setComputedStoreValues = require("../../setComputedStoreValues");
const Auth = require("./Auth");
const { Store } = require("../../models/Store");
const { PostalCode } = require("../../models/PostalCode");
const { Provider } = require("../../models/Provider");
const { ProviderBrand } = require("../../models/ProviderBrand");

class Appointments {
  static async refreshStores() {
    logger.notice("Begin refreshing appointments for all stores...");

    await Provider.query()
      .insert({
        id: "centura",
      })
      .onConflict(["id"])
      .merge();

    await ProviderBrand.query()
      .insert({
        provider_id: "centura",
        key: "centura_driveup_event",
        name: "Centura Health: Drive-Up Event",
        url:
          "https://www.centura.org/covid-19/covid-19-vaccine-information/vaccine-events",
      })
      .onConflict(["provider_id", "key"])
      .merge();

    const providerBrand = await ProviderBrand.query().findOne({
      provider_id: "centura",
      key: "centura_driveup_event",
    });

    const queue = new PQueue({ concurrency: 5 });

    const updatedProviderLocationIds = [];
    const lastFetched = DateTime.utc().toISO();
    const resp = await retry(
      async () => {
        const auth = await Auth.get();
        return got.post(
          "https://www.primarybio.com/test_groups/centuramassvaccine/appointment_slot_availabilities",
          {
            headers: {
              "User-Agent": "VaccineSpotter.org",
              "X-CSRF-TOKEN": auth.csrfToken,
            },
            cookieJar: auth.cookieJar,
            responseType: "json",
            timeout: 30000,
            retry: 0,
            json: {},
          }
        );
      },
      {
        retries: 2,
        onFailedAttempt: async (err) => {
          logger.warn(err);
          logger.warn(err?.response?.body);
          logger.warn(
            `Error fetching data (${err?.response?.statusCode}), attempting to refresh auth and then retry.`
          );
          await Auth.refresh();
        },
      }
    );

    const count = resp.body.appointment_slot_groups.length;
    for (const [index, store] of resp.body.appointment_slot_groups.entries()) {
      logger.info(
        `Processing ${store.title} - ${store.id} (${index + 1} of ${count})...`
      );

      if (!store.active) {
        logger.info(`Skipping inactive store: ${store.title}`);
        continue;
      }

      const raw = _.cloneDeep(resp.body);
      raw.appointment_slot_groups = [store];

      let { address } = store;
      if (
        address === "3185 Venetucci Boulevard, Colorado Springs, CO, USA" ||
        address === "3185 Venetucci Boulevard, Colorado Springs, CO, US"
      ) {
        address = "3185 Venetucci Boulevard, Colorado Springs, CO 80906, USA";
      } else if (address === "6000 Victory Way, Commerce City, CO, US") {
        address = "6000 Victory Way, Commerce City, CO 80022, USA";
      }

      const parsedAddress = parseAddress.parseLocation(address);
      let timeZone;
      if (parsedAddress.zip) {
        timeZone = (
          await PostalCode.query().findOne({
            postal_code: parsedAddress.zip,
          })
        ).time_zone;
      }
      if (!timeZone) {
        logger.warn(
          "Could not find store's time zone, falling back to America/Denver"
        );
        timeZone = "America/Denver";
      }

      let vaccineType;
      if (store.title.includes("Moderna")) {
        vaccineType = "Moderna";
      } else if (store.title.includes("Pfizer")) {
        vaccineType = "Pfizer";
      } else if (store.title.includes("J&J")) {
        vaccineType = "Johnson & Johnson";
      }

      const bookableSlots = Appointments.getBookableSlots(
        resp.body.appointment_slot_groups,
        { appointment_slot_group_id: store.id }
      );
      const appointments = _.orderBy(
        bookableSlots.map((slot) => ({
          appointment_types: [],
          vaccine_types: normalizedVaccineTypes(vaccineType),
          type: vaccineType,
          time: DateTime.fromISO(slot.starts_at, {
            zone: timeZone,
          }).toISO(),
        })),
        ["time", "type"]
      );

      updatedProviderLocationIds.push(store.id);

      const patch = {
        provider_id: "centura",
        provider_location_id: store.id,
        provider_brand_id: providerBrand.id,
        name: store.title,
        address: address.split(",")[0],
        city: parsedAddress.city,
        state: parsedAddress.state,
        postal_code: parsedAddress.zip,
        time_zone: timeZone,
        location: `point(${store.longitude} ${store.latitude})`,
        location_source: "provider",
        carries_vaccine: true,
        appointments,
        appointments_last_fetched: lastFetched,
        appointments_raw: raw,
        active: true,
      };
      setComputedStoreValues(patch);

      queue.add(() =>
        Store.query()
          .insert(patch)
          .onConflict(["provider_id", "provider_location_id"])
          .merge()
      );
    }

    await queue.onIdle();

    await Store.query()
      .where("provider_id", "centura")
      .whereNotIn("provider_location_id", updatedProviderLocationIds)
      .patch({ appointments_available: false, appointments: [] });

    logger.notice("Finished refreshing appointments for all stores.");
  }

  // Most of this appointment group/slot function logic is extracted from
  // Centura's logic directly from their site (via their Webpack source maps).
  // We don't necessarily need all this logic, but hopefully by using their
  // logic as-is, this will help reproduce their date and second appointment
  // logic as it shows up on their site.
  static buildFirstAppointmentSlots(
    selectedAppointmentSlotGroup,
    appointmentSlotGroupData,
    pairAppointmentSlots
  ) {
    let firstAppointmentSlots = selectedAppointmentSlotGroup.appointment_slots;

    if (
      pairAppointmentSlots &&
      selectedAppointmentSlotGroup.follow_up_required
    ) {
      let globalMaxDate = new Date();
      appointmentSlotGroupData
        .filter(
          (appointmentSlotGroup) =>
            appointmentSlotGroup.follow_up_test_configuration_id ===
            selectedAppointmentSlotGroup?.follow_up_test_configuration_id
        )
        .forEach((appointmentSlotGroup) => {
          const localMaxDate = new Date(
            Math.max(
              ...appointmentSlotGroup.appointment_slots.map((aS) =>
                new Date(aS.starts_at).getTime()
              )
            )
          );
          if (localMaxDate.getTime() > globalMaxDate.getTime()) {
            globalMaxDate = localMaxDate;
          }
        });
      globalMaxDate.setDate(
        globalMaxDate.getDate() -
          selectedAppointmentSlotGroup.follow_up_minimum_days || 0
      );

      firstAppointmentSlots = firstAppointmentSlots.filter(
        (appointmentSlot) =>
          new Date(appointmentSlot.starts_at).getTime() <=
          globalMaxDate.getTime()
      );
    }
    return firstAppointmentSlots;
  }

  static buildValidAppointmentSlotGroups(
    appointmentSlotGroups,
    selectedAppointmentSlotGroup
  ) {
    return appointmentSlotGroups.filter(
      (appointmentSlotGroup) =>
        selectedAppointmentSlotGroup.follow_up_test_configuration_id ===
        appointmentSlotGroup.follow_up_test_configuration_id
    );
  }

  static buildValidAppointmentSlots(
    selectedAppointmentSlot,
    appointmentSlots,
    followUpMinimumDays,
    followUpMaximumDays
  ) {
    const minimumDate = new Date(selectedAppointmentSlot.starts_at);
    minimumDate.setDate(minimumDate.getDate() + followUpMinimumDays);
    minimumDate.setHours(minimumDate.getHours() - 8);

    const maximumDate = new Date(selectedAppointmentSlot.starts_at);
    maximumDate.setDate(maximumDate.getDate() + followUpMaximumDays);
    maximumDate.setHours(maximumDate.getHours() + 8);

    return appointmentSlots.filter((appointmentSlot) => {
      const appointmentSlotTime = new Date(appointmentSlot.starts_at).getTime();
      return (
        appointmentSlotTime > minimumDate.getTime() &&
        appointmentSlotTime < maximumDate.getTime()
      );
    });
  }

  static getAppointmentSlots(appointmentSlotGroupData, values) {
    const testGroup = {
      only_one_location_for_follow_up: true,
      only_show_first_dose_appointment_slots_with_pair: true,
    };

    const appointmentSlotGroups = appointmentSlotGroupData.filter(
      (appointmentSlotGroup) => {
        if (!appointmentSlotGroup.active) return false;
        if (appointmentSlotGroup.test_location.on_demand) return false;
        if (!appointmentSlotGroup.address_bounding_boxes) return true;

        throw new Error("address_bounding_boxes logic not implemented");
        // const inAtLeastOneBoundingBox = appointmentSlotGroup.address_bounding_boxes.some((boundingBox) => Primary.pointInPolygon([values.lat, values.lng], boundingBox));
        // return inAtLeastOneBoundingBox;
      }
    );

    const selectedAppointmentSlotGroup = appointmentSlotGroupData.find(
      (appointmentSlotGroup) =>
        appointmentSlotGroup.id === values.appointment_slot_group_id
    );

    let firstAppointmentSlots;
    let validFollowUpAppointmentSlotGroups;
    if (selectedAppointmentSlotGroup) {
      firstAppointmentSlots = Appointments.buildFirstAppointmentSlots(
        selectedAppointmentSlotGroup,
        appointmentSlotGroupData,
        testGroup.only_show_first_dose_appointment_slots_with_pair
      );

      validFollowUpAppointmentSlotGroups = testGroup.only_one_location_for_follow_up
        ? [selectedAppointmentSlotGroup]
        : Appointments.buildValidAppointmentSlotGroups(
            appointmentSlotGroups,
            selectedAppointmentSlotGroup
          );
    }

    return {
      selectedAppointmentSlotGroup,
      firstAppointmentSlots,
      validFollowUpAppointmentSlotGroups,
    };
  }

  static getBookableSlots(appointmentSlotGroupData, values) {
    const {
      selectedAppointmentSlotGroup,
      firstAppointmentSlots,
      validFollowUpAppointmentSlotGroups,
    } = Appointments.getAppointmentSlots(appointmentSlotGroupData, values);

    let bookableSlots = [];
    if (!selectedAppointmentSlotGroup.follow_up_required) {
      bookableSlots = firstAppointmentSlots;
    } else {
      for (const firstAppointmentSlot of firstAppointmentSlots) {
        for (const followUpSlotGroup of validFollowUpAppointmentSlotGroups) {
          const validSecondAppointments = Appointments.buildValidAppointmentSlots(
            firstAppointmentSlot,
            followUpSlotGroup.appointment_slots,
            selectedAppointmentSlotGroup.follow_up_minimum_days,
            selectedAppointmentSlotGroup.follow_up_maximum_days
          );
          if (validSecondAppointments.length > 0) {
            bookableSlots.push(firstAppointmentSlot);
          }
        }
      }
    }

    return bookableSlots;
  }
}

module.exports = Appointments;
