const _ = require("lodash");
const albertsonsAuth = require("../albertsons/auth");
const albertsonsFetch = require("../albertsons/fetch");
const dateAdd = require("date-fns/add");
const getDatabase = require("../getDatabase");
const got = require("got");

module.exports.refreshAlbertsons = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: "albertsons_stores",
  });

  const currentMonth = new Date();
  const nextMonth = dateAdd(new Date(), { months: 1 });
  const months = [currentMonth, nextMonth];

  let { resources } = await container.items
    .query({
      query:
        "SELECT * from c WHERE c.clientName != null AND c.lastFetched <= @minsAgo",
      parameters: [
        {
          name: "@minsAgo",
          value: dateAdd(new Date(), { minutes: -2 }).toISOString(),
        },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);

  const storesWithAppointments = {};
  const ids = resources.map((r) => r.id);
  const idChunks = _.chunk(ids, 6);
  for (const chunk of idChunks) {
    console.info(`Checking if stores support vaccines: ${chunk.join(",")}`);
    const locationsResp = await albertsonsFetch(async () => {
      const auth = await albertsonsAuth.get();
      return await got(
        "https://kordinator.mhealthcoach.net/loadLocationsForClientAndApptType.do",
        {
          searchParams: {
            _r: _.random(0, 999999999999),
            apptKey: "COVID_VACCINE_DOSE1_APPT",
            clientIds: chunk.join(","),
            csrfKey: auth.body.csrfKey,
            externalClientId: "1610133367915",
            instore: "yes",
          },
          headers: {
            "User-Agent":
              "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
          },
          cookieJar: auth.cookieJar,
          responseType: "json",
        }
      );
    });

    for (const store of locationsResp.body) {
      storesWithAppointments[store.clientId] = true;
    }
  }

  let i = 0;
  for (const resource of resources) {
    i++;
    console.info(
      `Processing ${resource.name} (${i} of ${resources.length})...`
    );

    const lastFetched = new Date().toISOString();

    let slotDates = [];
    let events = [];
    if (!storesWithAppointments[resource.id]) {
      console.info(
        "  Store does not currently support vaccines, so skipping fetching appointment slots"
      );
    } else {
      for (const month of months) {
        console.info("  Fetching days with open appointments...");
        const daysResp = await albertsonsFetch(async () => {
          const auth = await albertsonsAuth.get();
          return got.post(
            "https://kordinator.mhealthcoach.net/loadEventSlotDaysForCoach.do",
            {
              searchParams: {
                cva: "true",
                type: "registration",
                _r: _.random(0, 999999999999),
                csrfKey: auth.body.csrfKey,
              },
              headers: {
                "User-Agent":
                  "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
              },
              cookieJar: auth.cookieJar,
              responseType: "json",
              form: {
                slotsYear: month.getFullYear(),
                slotsMonth: month.getMonth() + 1,
                forceAllAgents: "",
                manualOptionAgents: "",
                companyName: resource.clientName,
                eventType: "COVID Vaccine Dose 1 Appt",
                eventTitle: "",
                location: resource.name,
                locationTimezone: resource.timezone,
                csrfKey: auth.body.csrfKey,
              },
              retry: 0,
            }
          );
        });

        slotDates = slotDates.concat(daysResp.body.slotDates);
      }

      for (const date of slotDates) {
        console.info(`  Fetching appointments on ${date}...`);
        const eventsResp = await albertsonsFetch(async () => {
          const auth = await albertsonsAuth.get();
          return got.post(
            "https://kordinator.mhealthcoach.net/loadEventSlotsForCoach.do",
            {
              searchParams: {
                cva: "true",
                type: "registration",
                _r: _.random(0, 999999999999),
                csrfKey: auth.body.csrfKey,
              },
              headers: {
                "User-Agent":
                  "covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)",
              },
              cookieJar: auth.cookieJar,
              responseType: "json",
              form: {
                eventDate: date,
                companyName: resource.clientName,
                forceAllAgents: "",
                eventType: "COVID Vaccine Dose 1 Appt",
                eventTitle: "",
              },
              retry: 0,
            }
          );
        });
        events = events.concat(eventsResp.body);
      }
    }

    await container.item(resource.id).replace({
      ...resource,
      lastFetched,
      slotDates,
      events,
    });
  }
};

// module.exports.refreshAlbertsons();
