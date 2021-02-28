# covid-vaccine-finder


## Building/Running

### Site
`npx @11ty/eleventy` seems to throw an error due to not being able to find `states` data or something?

building the frontend probably depends on the backend to display data

## Steps to Add a location

- add an export to `index.js` like this: ` exports.refreshAlbertsons = require('./src/handlers/refreshAlbertsons').refreshAlbertsons;`

