const _ = require('lodash');
const retry = require('async-retry');
const sleep = require('sleep-promise');
const RandomHttpUserAgent = require('random-http-useragent')
const { DateTime, Settings } = require('luxon');
const getDatabase = require('../getDatabase');
const got = require('got');
const cheerio = require('cheerio');

Settings.defaultZoneName = 'America/Denver';

module.exports.refreshPharmaca = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({ id: "pharmaca_stores" });

  const tomorrow = DateTime.local().plus({ days: 1 });

  let { resources } = await container.items
    .query({
      query: "SELECT * from c WHERE (c.state = 'Colorado' OR c.state = 'CO') AND (NOT is_defined(c.lastFetched) OR c.lastFetched <= @minsAgo)",
      parameters: [
        { name: '@minsAgo', value: DateTime.utc().minus({ minutes: 2 }).toISO() },
      ],
    })
    .fetchAll();
  resources = _.shuffle(resources);
  let i = 0;
  for (const resource of resources) {
    i++;
    console.info(`Processing store #${resource.id} (${i} of ${resources.length})...`);

    const lastFetched = DateTime.utc().toISO()

    const resp = await got(`https://pharmaca.as.me/${resource.scheduleId}`, {
      headers: {
        'User-Agent': 'covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)',
      },
      retry: 0,
    });
    const $ = cheerio.load(resp.body);

    const calendarId = resp.body.match(/calendarID=(\d+)/)[1];

    const appointments = {};
    let anyAppointments = false;

    const covidLabels = $('label[for^="appointmentType-"]:contains("COVID")');
    for (const covidLabel of covidLabels) {
      const $covidLabel = $(covidLabel)
      const appointmentTypeId = $covidLabel.attr('for').match(/appointmentType-(.+)/)[1];
      const appointmentCalendarId = resp.body.match(new RegExp(`typeToCalendars\\[${appointmentTypeId}\\].*?(\\d+)`))[1]

      const scheduleResp = await got.post('https://pharmaca.as.me/schedule.php', {
        searchParams: {
          action: 'showCalendar',
          fulldate: '1',
          owner: '20105611',
          template: 'weekly',
        },
        headers: {
          'User-Agent': 'covid-vaccine-finder/1.0 (https://github.com/GUI/covid-vaccine-finder)',
        },
        form: {
          type: appointmentTypeId,
          calendar: appointmentCalendarId,
          skip: 'true',
          'options[qty]': '1',
          'options[numDays]': '5',
          ignoreAppointment: '',
          appointmentType: '',
          calendarID: calendarId,
        },
      });

      const $schedule = cheerio.load(scheduleResp.body);
      const timeInputs = $schedule('input[name="time[]"]');
      const times = [];
      for (const timeInput of timeInputs) {
        const time = $(timeInput).attr('value');
        times.push(time);
        anyAppointments = true;
      }

      times.sort();
      appointments[_.trim($covidLabel.text())] = times;
      await sleep(1000);
    }

    await container.items.upsert({
      ...resource,
      appointments,
      anyAppointments,
      lastFetched,
    });
  }
}

// module.exports.refreshPharmaca();
