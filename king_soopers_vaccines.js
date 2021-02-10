const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter1 = new FileSync('king_soopers_reasons.json');
const db1 = low(adapter1);
const stores = db1.get('stores').filter((store) => {
  for(const reason of store.reasons) {
    if (reason.ar_id === 107) {
      return true
    }
  }

  return false;
}).value();

const adapter = new FileSync('king_soopers_vaccines.json');
const db = low(adapter);
db.defaults({ stores: [], vaccinesLastProcessed: {} }).write();

const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  await page.goto('https://www.kingsoopers.com/rx/guest/get-vaccinated', { waitUntil: 'networkidle0' });

  for (const store of stores) {
    const lastProcessed = db.get(`vaccinesLastProcessed.${store.facilityId}`).value();
    if (lastProcessed) {
      console.log(`Skipping ${store.facilityId}`);
    } else {
      console.log(`Processing ${store.facilityId}`);

      await page.goto(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`, { waitUntil: 'networkidle0' });
      const data = await page.evaluate(() => {
        return JSON.parse(document.querySelector('body').innerText);
      });

      store.vaccines = data;
      db.get('stores').push(store).write();
      db.set(`vaccinesLastProcessed.${store.facilityId}`, (new Date()).toISOString()).write();

      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await browser.close();
})();

