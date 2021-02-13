const got = require('got');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

var ProxyLists = require('proxy-lists');

const Apify = require('apify');
const { utils: { requestAsBrowser } } = Apify;

const adapter1 = new FileSync('site/_data/krogerReasons.json');
const db1 = low(adapter1);
const stores = db1.get('stores').filter((store) => {
  for(const reason of store.reasons) {
    if (reason.ar_id === 107) {
      return true
    }
  }

  return false;
}).value();

const adapter2 = new FileSync('site/_data/krogerAppointmentsLastProcessed.json');
const db2 = low(adapter2);
db2.defaults({ appointmentsLastProcessed: {} }).write();

const adapter = new FileSync('site/_data/krogerAppointments.json');
const db = low(adapter);
db.defaults({ stores: [] }).write();

const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const stealth = StealthPlugin()
stealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(stealth);

const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
const ua = UserAgentOverride({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
})
puppeteer.use(ua);

const {promisify} = require('util');
const {CookieJar, Cookie} = require('tough-cookie');
const cookieJar = new CookieJar();
const setCookie = promisify(cookieJar.setCookie.bind(cookieJar));

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

(async () => {
  let browser = await puppeteer.launch({ headless: false, devtools: false });

  let success = false;
  while(!success) {
    try {
      const page = await browser.newPage();
      await page.goto('https://www.kingsoopers.com/rx/guest/get-vaccinated', { waitUntil: 'networkidle0' });

      'https://www.kingsoopers.com/auth/api/authentication-state?refresh=true'

      const cookies = await page.cookies()
      console.info(cookies);
      for (const cookie of cookies) {
        const c = new Cookie({
          key: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          /*
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
          */
        })
        if (cookie.expires !== -1) {
          //c.expires = new Date(cookie.expires);
        }
        await setCookie(c, 'https://www.kingsoopers.com/rx/guest/get-vaccinated');
      }
      console.info(cookieJar);
      console.info(cookieJar.toJSON());
      console.info(await cookieJar.getCookieString('https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy', { http: true, expire: false, allPaths: true }));
          //await new Promise(r => setTimeout(r, 200000));

      /*
      await page.$eval('[name=findAStore]', el => el.click());
      await page.$eval('[name=findAStore]', el => el.value = '');
      await page.type('[name=findAStore]', '80401');
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.press('Enter');
      //await page.waitForNavigation({ waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 2000));
      await page.click('[aria-label="Select Golden as pharmacy location"]');
      await new Promise(r => setTimeout(r, 500));
      await page.click('[aria-label="Continue to step 1 of 7 of the Vaccination Form"]');
      await new Promise(r => setTimeout(r, 2000));
      await page.click('[name="COVID-19 Vaccine"]');
      await new Promise(r => setTimeout(r, 500));
      await page.click('[aria-label="Continue to step 2 of 7 of the Vaccination Form"]');
      */

      /*
      ProxyLists.getProxies({
        // options
        countries: ['us', 'ca']
      })
        .on('data', function(proxies) {
          // Received some proxies.
          console.log('got some proxies');
          console.log(proxies);
        })
        .on('error', function(error) {
          // Some error has occurred.
          console.log('error!', error);
        })
        .once('end', function() {
          // Done getting proxies.
          console.log('end!');
        });
        */


      shuffle(stores);
      for (const store of stores) {
        let lastProcessed = db2.get(`appointmentsLastProcessed.${store.facilityId}`).value();
        if (lastProcessed) {
          lastProcessed = Date.parse(lastProcessed);
        }

        if (lastProcessed && Date.now() - lastProcessed <= 5 * 60 * 1000) {
          console.log(`Skipping ${store.facilityId}`);
        } else {
          console.log(`Processing ${store.facilityId}`);

          /*
          const response = await requestAsBrowser({
            url: `https://app.scrapingbee.com/api/v1/?api_key=KV4P63N0ZXDEMO5X43O16C8Y8UNDK2V5IEIXBYQ0FZJVCT45L4LRV1TWWHZWIPLEQ32VPN3AMINIESCN&url=${encodeURIComponent(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`)}&render_js=false&premium_proxy=true&country_code=us`,
          });

          const response = await got(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`, {
            headers: {
            */
             // 'accept': 'application/json, text/plain, */*',
              /*'accept-language': 'en-US,en;q=0.9',
              'rx-channel': 'WEB',
              'referer': 'https://www.kingsoopers.com/rx/guest/get-vaccinated',
              'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
              */
              // "accept": "application/json, text/plain, */*",
              /*"accept-language": "en-US,en;q=0.9",
              "cache-control": "no-cache",
              "pragma": "no-cache",
              "rx-channel": "WEB",
              "sec-ch-ua": "\"Chromium\";v=\"88\", \"Google Chrome\";v=\"88\", \";Not A Brand\";v=\"99\"",
              "sec-ch-ua-mobile": "?0",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              "referrer": "https://www.kingsoopers.com/rx/guest/get-vaccinated",
              //cookie: 'pid=24c79cf1-c913-4034-87cf-06bb0978da04; origin=lvdc; abTest=tl_dyn-pos_A; dtCookie=41$25D35694BDC370CD5DC9BFA7C8BD3595; ak_bmsc=2E3072B540A62E80018EDD4F4C7C5DCA173A5CAD202000003DB5246046654124~plZM1G1LfGaTb+WUkCpKW9TSltk8dSo/3SnO8nfL5Hgf7PLob+IQmTMcdZZkVYsI7AoRYoNLvNCwdTAOUTqaWhxYxG+Zj/7AyKw/+5mJUs/JEm6f35RDx5V+VEeSUpGzV06EBM2byhbwa8lVSOd1Gt84btIBJzMs3AE+2ftyovq6M0bXknyTVmVkMgCbaOKXQlC5XydWoOgJI3c1mVhX6iPvxmptQ1ZJoH/66sR66NlWo=; akaalb_KT_Digital_BannerSites=~op=KT_Digital_BannerSites_KCVG_CDC_FailoverHDC:cdc|~rv=100~m=cdc:0|~os=49d9e32c4b6129ccff2e66f9d0390271~id=96f729398ec5a9a063282892c473680d; bm_sz=893B7B910880D24AAEDA4024D5FDAC9F~YAAQrVw6F9Rf9Ix3AQAAsfhjjwpzm6T5StNekGHOn9mxggE2JxuE7RyKFOnmOXq3O3Qc42Qt1X8315khXZXvB8KaoFoXmxG6DYs4yscQb8FfTC7kVYQ98TCjZUfHmllABt04Q1QCFKwdYi5kAutqx8ydQ3yHvK+Dxews66C7kJOy7dCGdaaY+Tn186TOe+OoEEuwoLU=; akacd_RWASP-default-phased-release=3790471228~rv=13~id=ec8ca97ff44107ea458e2ac380bdce8c; sid=b057c091-c5c1-47ae-8399-6914bf7f9177; __VCAP_ID__=ddf347ab-0f60-4948-4de9-9eb4; AMCVS_371C27E253DB0F910A490D4E%40AdobeOrg=1; x-active-modality={"type":"PICKUP","locationId":"62000001"}; bm_mi=FB49D7A2734BB0E5A33CA38AF0924A15~GFICHjZQu1t8gswfAq3sEnonqXp9hNdvLD+YJzxTJnc8gLY3bQ3MEi7YmMV7iIVJX3h3V0ZultJSdzzgJhyib2UFJCOhP4UMIFQlqBaBFbEEjCjSVOIav1c7ZLSNMK8WB1T4V7hmd3D7xg8hAA7XcPTy3OG8cLKYVzWEc3hCCWoIaJotMV3OMXBcf6p3Eh1xFM9k3BU5mMvK6y++q6wBvqNStO9gb/wlfljDCg0lUz+2IXvXU05qOSfaaClk34/58lE0BOLIz1FTnbQztplpdA==; AMCV_371C27E253DB0F910A490D4E%40AdobeOrg=-432600572%7CMCIDTS%7C18670%7CMCMID%7C82036185129886158769212354075612813368%7CMCAID%7CNONE%7CMCOPTOUT-1613025991s%7CNONE%7CvVersion%7C4.5.2; _abck=8F055602E75F83929053D6CA9F8639FB~-1~YAAQrVw6F4gQ9ox3AQAAQ3ysjwVBpOHO4Ya1AuSuNs3Z3FpMdJtSmuSsUjJdkbt9Hjd+EA4aaSkhMfc9cO9VGJE3M6qUbGTi6qehfaAz3DcGARjiOihVMeeUXqax3bhQS5TgQrwc7Wb4Trh5/0n13cmlAI8YlaWVoGj/4v+2xDVewcWlPRCf8uYreux6kuE/pAQ6wB667xJYg+yPnp2ab5RKL1O1qmpbyO4flv+m9A4AgMYGXjOlO75wOgoa0YAZPK/R0W3TQB250jcXI2LsnVvM9QhJUs4/PZJZgpLK6B9FWlUN8MHVqEEQ5RFf6aCJicXS5FWAZnoYjqgyprhw1kBmnuzyZsVeV3gqdshnwZlYf2KhVpmpTg==~0~-1~-1; bm_sv=268461DA12EE79B43D5A0DC9F2E3366C~iVvDA4VwKbDnAMQwcQZW59gMPgdmTJPitca8uAJLPNsSO/HNjnksc254//TYctSajNIBIOJ5RS2q72aFD6p2mmzoI/z0V20TFiCBXPJjP80JyYbl/9PpJalopAK3GnH/htjthxJMzCiorcWOZTYsdDnEalvblVPDl8uSB8uCA0E=',
            },
            http2: true,
            cookieJar,
          });
          console.info(response.body);

          const data = JSON.parse(response.body);
          */

          /*
          const page = await browser.newPage();
          await page.goto('https://www.kingsoopers.com/rx/guest/get-vaccinated', { waitUntil: 'networkidle0' });
          */

          /*
          let response = await page.goto(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`, { waitUntil: 'networkidle0' });
          //console.info(response);
          console.info(response.headers());
          const status = response.headers().status;
          if (status !== 200) {
            const resp = await page.goto('https://www.kingsoopers.com/auth/api/authentication-state?refresh=true', { waitUntil: 'networkidle0' });
            console.info(resp.headers());

            response = await page.goto(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${store.facilityId}/107`, { waitUntil: 'networkidle0' });
          }
          console.info(response.headers());
          const data = await page.evaluate(() => {
            return JSON.parse(document.querySelector('body').innerText);
          });
          */

          const data = await page.evaluate(async (facilityId) => {
            let response = await fetch(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${facilityId}/107`, {
              headers: {
                "accept": "application/json, text/plain, */*",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "rx-channel": "WEB",
              },
            });
            console.log('status: ', response.status);
            if(response.status !== 200) {
              function randomInteger(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
              }

              await new Promise(r => setTimeout(r, randomInteger(1500, 3000)));
              const auth = await fetch('https://www.kingsoopers.com/auth/api/authentication-state?refresh=true', {
                headers: {
                  "accept": "application/json, text/plain, */*",
                  "cache-control": "no-cache",
                  "pragma": "no-cache",
                  "rx-channel": "WEB",
                },
              });
              console.log('auth status2: ', auth.status);

              await new Promise(r => setTimeout(r, randomInteger(1500, 3000)));
              response = await fetch(`https://www.kingsoopers.com/rx/api/anonymous/scheduler/dates/pharmacy/${facilityId}/107`, {
                headers: {
                  "accept": "application/json, text/plain, */*",
                  "cache-control": "no-cache",
                  "pragma": "no-cache",
                  "rx-channel": "WEB",
                },
              });
              console.log('status2: ', response.status);
            }

            console.log('status3: ', response.status);
            const text = await response.text();
            return JSON.parse(text);
          }, store.facilityId);

          db.get('stores').remove({
            facilityId: store.facilityId,
          }).write();
          db.get('stores').push({
            facilityId: store.facilityId,
            appointments: data,
          }).write();
          db2.set(`appointmentsLastProcessed.${store.facilityId}`, (new Date()).toISOString()).write();

          db.set('stores', db.get('stores').uniqBy('facilityId').sortBy('facilityId').value()).write();

          //page.close()

          await new Promise(r => setTimeout(r, randomInteger(1500, 6000)));
        }
      }

      success = true
    } catch(e) {
      console.error(e);
      await browser.close();
      await new Promise(r => setTimeout(r, 10000));
      browser = await puppeteer.launch({ headless: false, devtools: false });
    }
  }
})();
