#!/usr/bin/env node
const fs = require('fs');
const download = require('download');

createDirRecursive = (path) => {
    fs.mkdir(path, { recursive: true }, (err) => { if (err) throw err; });
}

const apiBaseUri = `https://www.vaccinespotter.org/api/v0`
const supportedStores = ['albertsons', 'walgreens', 'walmart', 'cvs',
                         'sams_club', 'pharmaca', 'rite_aid', 'kroger',
                         'hyvee', 'thrifty_white'];

const baseStoresDir = 'site/api/v0/stores'
createDirRecursive(baseStoresDir);
(async () => {
    // Download the state data first for state code scraping
    await download(`${apiBaseUri}/states.json`, `site/api/v0/`);
    const stateData = JSON.parse(fs.readFileSync('site/api/v0/states.json'));
    let storeApptDownloadPromises = [];
    stateData.forEach(state => {
        createDirRecursive(`${baseStoresDir}/${state.code}`);
        supportedStores.forEach(store => {
            const uri = `${apiBaseUri}/stores/${state.code}/${store}.json`;
            const filePath = `${baseStoresDir}/${state.code}/`
            storeApptDownloadPromises.push(download(uri, filePath)
                .catch(error => {
                    // It is expected that many calls will result in a 404, as
                    //  not all states have the same stores
                    if (error.statusCode !== 404) {
                        console.log(`ERROR downloading store data: ${error}`);
                    }
                })
            )
        });
    });
    Promise.all(storeApptDownloadPromises);
})();
