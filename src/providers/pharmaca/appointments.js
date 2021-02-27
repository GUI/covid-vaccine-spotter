const { default: PQueue } = require("p-queue");
const _ = require("lodash");
const { DateTime } = require("luxon");
const got = require("got");
const sleep = require("sleep-promise");
const cheerio = require("cheerio");
const logger = require("../../logger");
const { Store } = require("../../models/Store");

const PharmacaAppointments = {
  refreshStores: async () => {
    logger.notice("Begin refreshing appointments for all stores...");

    const queue = new PQueue({ concurrency: 1 });

    const stores = await Store.query()
      .where("brand", "pharmaca")
      .whereRaw(
        "(appointments_last_fetched IS NULL OR appointments_last_fetched <= (now() - interval '2 minutes'))"
      )
      .orderByRaw("appointments_last_fetched NULLS FIRST");
    for (const [index, store] of stores.entries()) {
      queue.add(() =>
        PharmacaAppointments.refreshStore(store, index, stores.length)
      );
    }
    await queue.onIdle();

    logger.notice("Finished refreshing appointments for all stores.");
  },

  refreshStore: async (store, index, count) => {
    logger.info(
      `Processing ${store.name} #${store.brand_id} (${
        index + 1
      } of ${count})...`
    );

    await sleep(_.random(250, 750));

    const patch = {
      appointments: [],
      appointments_last_fetched: DateTime.utc().toISO(),
      appointments_available: false,
      appointments_raw: {},
    };

    const schedulePageResp = await PharmacaAppointments.fetchSchedulePage(
      store
    );
    patch.appointments_raw.schedule_page = schedulePageResp.body;
    const $schedulePage = cheerio.load(schedulePageResp.body);

    const calendarId =
      schedulePageResp.body.match(/calendarID=(\d+)/)?.[1] || "";

    const appointmentLabels = $schedulePage(
      'label[for^="appointmentType-"]:contains("COVID")'
    );
    for (const appointmentLabel of appointmentLabels) {
      const $appointmentLabel = $schedulePage(appointmentLabel);
      const appointmentLabelText = _.trim($appointmentLabel.text());

      if (appointmentLabelText === "COVID-19 Vaccine - Currently Unavailable") {
        patch.carries_vaccine = false;
      } else {
        patch.carries_vaccine = true;

        const appointmentTypeId = $appointmentLabel
          .attr("for")
          .match(/appointmentType-(.+)/)[1];

        const appointmentCalendarId = schedulePageResp.body.match(
          new RegExp(`typeToCalendars\\[${appointmentTypeId}\\].*?(\\d+)`)
        )[1];

        const appointmentScheduleResp = await PharmacaAppointments.fetchAppointmentSchedule(
          {
            calendarId,
            appointmentTypeId,
            appointmentCalendarId,
          }
        );
        patch.appointments_raw[appointmentLabelText] =
          appointmentScheduleResp.body;
        const $appointmentSchedule = cheerio.load(appointmentScheduleResp.body);

        const timeInputs = $appointmentSchedule('input[name="time[]"]');
        for (const timeInput of timeInputs) {
          const time = $appointmentSchedule(timeInput).attr("value");
          patch.appointments.push({
            type: appointmentLabelText,
            time: DateTime.fromFormat(time, "yyyy-LL-dd HH:mm", {
              zone: store.time_zone,
            }).toISO(),
          });
        }
      }

      await sleep(_.random(250, 750));
    }

    patch.appointments = _.orderBy(patch.appointments, ["time", "type"]);

    if (patch.appointments.length > 0) {
      patch.appointments_available = true;
    }

    await Store.query().findById(store.id).patch(patch);

    await sleep(_.random(250, 750));
  },

  fetchSchedulePage: async (store) =>
    got(`https://pharmaca.as.me/${store.metadata_raw.schedule_url_id}`, {
      headers: {
        "User-Agent":
          "covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)",
      },
      retry: 0,
    }),

  fetchAppointmentSchedule: async ({
    calendarId,
    appointmentTypeId,
    appointmentCalendarId,
  }) =>
    got.post("https://pharmaca.as.me/schedule.php", {
      searchParams: {
        action: "showCalendar",
        fulldate: "1",
        owner: "20105611",
        template: "weekly",
      },
      headers: {
        "User-Agent":
          "covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)",
      },
      form: {
        type: appointmentTypeId,
        calendar: appointmentCalendarId,
        skip: "true",
        "options[qty]": "1",
        "options[numDays]": "5",
        ignoreAppointment: "",
        appointmentType: "",
        calendarID: calendarId,
      },
    }),
};

module.exports = PharmacaAppointments;
