const _ = require('lodash');
const albertsonsAuth = require('../albertsons/auth');
const albertsonsFetch = require('../albertsons/fetch');
const dateAdd = require('date-fns/add')
const getDatabase = require('../getDatabase');
const got = require('got');

module.exports.refreshAlbertsons = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "albertsons_stores" });

  const currentMonth = new Date();
  const nextMonth = dateAdd(new Date(), { months: 1 });
  const months = [
    currentMonth,
    nextMonth,
  ];

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE c.clientName != null AND c.lastFetched <= @minsAgo",
      parameters: [
        { name: '@minsAgo', value: dateAdd(new Date(), { minutes: -2 }).toISOString() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i++;
    console.info(`Processing ${resource.name} (${i} of ${resources.length})...`);

    const lastFetched = (new Date()).toISOString();

    let slotDates = [];
    let events = [];
    for (const month of months) {
      console.info('  Fetching days with open appointments...');
      const daysResp = await albertsonsFetch(async () => {
        const auth = await albertsonsAuth.get();
        return got.post('https://kordinator.mhealthcoach.net/loadEventSlotDaysForCoach.do', {
          searchParams: {
            cva: 'true',
            type: 'registration',
            _r: _.random(0, 999999999999),
            csrfKey: auth.body.csrfKey,
          },
          headers: {
            'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
          },
          cookieJar: auth.cookieJar,
          responseType: 'json',
          form: {
            slotsYear: month.getFullYear(),
            slotsMonth: month.getMonth() + 1,
            forceAllAgents: '',
            manualOptionAgents: '',
            companyName: resource.clientName,
            eventType: 'COVID Vaccine Dose 1 Appt',
            eventTitle: '',
            location: resource.name,
            locationTimezone: resource.timezone,
            csrfKey: auth.body.csrfKey,
          },
          retry: 0,
        });
      });

      slotDates = slotDates.concat(daysResp.body.slotDates);
    }

    for (const date of slotDates) {
      console.info(`  Fetching appointments on ${date}...`);
      const eventsResp = await albertsonsFetch(async () => {
        const auth = await albertsonsAuth.get();
        return got.post('https://kordinator.mhealthcoach.net/loadEventSlotsForCoach.do', {
          searchParams: {
            cva: 'true',
            type: 'registration',
            _r: _.random(0, 999999999999),
            csrfKey: auth.body.csrfKey,
          },
          headers: {
            'User-Agent': 'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
          },
          cookieJar: auth.cookieJar,
          responseType: 'json',
          form: {
            eventDate: date,
            companyName: resource.clientName,
            forceAllAgents: '',
            eventType: 'COVID Vaccine Dose 1 Appt',
            eventTitle: '',
          },
          retry: 0,
        });
      });
      events = events.concat(eventsResp.body);
    }

    await container.item(resource.id).replace({
      ...resource,
      lastFetched,
      slotDates,
      events,
    });
  }
}
