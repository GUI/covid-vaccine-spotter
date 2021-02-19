const _ = require('lodash');
const retry = require('async-retry');
const sleep = require('sleep-promise');
const RandomHttpUserAgent = require('random-http-useragent')
const { DateTime, Settings } = require('luxon');
const getDatabase = require('../getDatabase');
const got = require('got');

Settings.defaultZoneName = 'America/Denver';

const puppeteer = require('puppeteer-extra');

const pluginStealth = require('puppeteer-extra-plugin-stealth')();
console.log(pluginStealth.availableEvasions);
console.log(pluginStealth.enabledEvasions);
pluginStealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(pluginStealth);

const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override');
const ua = UserAgentOverride({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15',
});
puppeteer.use(ua);

const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin())

module.exports.refreshKroger = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: [
      '--incognito',
    ],
  });
  const page = await browser.newPage();

  await page.goto('https://www.kingsoopers.com/rx/covid-vaccine');
}

module.exports.refreshKroger();
