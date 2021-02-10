const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter1 = new FileSync('king_soopers_stores.json');
const db1 = low(adapter1);
const stores = db1.get('stores').value();

const adapter = new FileSync('king_soopers_reasons.json');
const db = low(adapter);
db.defaults({ stores: [], reasonsLastProcessed: {} }).write();

const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  await page.goto('https://www.kingsoopers.com/rx/guest/get-vaccinated', { waitUntil: 'networkidle0' });

  for (const store of stores) {
    const lastProcessed = db.get(`reasonsLastProcessed.${store.facilityId}`).value();
    if (lastProcessed) {
      console.log(`Skipping ${store.facilityId}`);
    } else {
      console.log(`Processing ${store.facilityId}`);

      await page.goto(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/reasons/pharmacy/${store.facilityId}`, { waitUntil: 'networkidle0' });
      const data = await page.evaluate(() => {
        return JSON.parse(document.querySelector('body').innerText);
      });

      store.reasons = data;
      db.get('stores').push(store).write();
      db.set(`reasonsLastProcessed.${store.facilityId}`, (new Date()).toISOString()).write();

      db.set('stores', db.get('stores').uniqBy('facilityId').sortBy('facilityId').value()).write();

      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await browser.close();
})();

