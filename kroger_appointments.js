const got = require('got');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const Apify = require('apify');
const { utils: { requestAsBrowser } } = Apify;

const adapter1 = new FileSync('kroger_reasons.json');
const db1 = low(adapter1);
const stores = db1.get('stores').filter((store) => {
  for(const reason of store.reasons) {
    if (reason.ar_id === 107) {
      return true
    }
  }

  return false;
}).value();

const adapter2 = new FileSync('kroger_appointments_last_processed.json');
const db2 = low(adapter2);
db2.defaults({ appointmentsLastProcessed: {} }).write();

const adapter = new FileSync('kroger_appointments.json');
const db = low(adapter);
db.defaults({ stores: [] }).write();

(async () => {
  for (const store of stores) {
    let lastProcessed = db2.get(`appointmentsLastProcessed.${store.facilityId}`).value();
    if (lastProcessed) {
      lastProcessed = Date.parse(lastProcessed);
    }

    if (lastProcessed && Date.now() - lastProcessed <= 5 * 60 * 1000) {
      console.log(`Skipping ${store.facilityId}`);
    } else {
      console.log(`Processing ${store.facilityId}`);

      const response = await requestAsBrowser({
        url: `https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`
      });
      const data = JSON.parse(response.body);

      db.get('stores').remove({
        facilityId: store.facilityId,
      }).write();
      db.get('stores').push({
        facilityId: store.facilityId,
        appointments: data,
      }).write();
      db2.set(`appointmentsLastProcessed.${store.facilityId}`, (new Date()).toISOString()).write();

      db.set('stores', db.get('stores').uniqBy('facilityId').sortBy('facilityId').value()).write();

      await new Promise(r => setTimeout(r, 2000));
    }
  }
})();
