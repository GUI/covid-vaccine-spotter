# covid-vaccine-finder


## Building/Running

### Site
`npx @11ty/eleventy` seems to throw an error due to not being able to find `states` data or something?

building the frontend probably depends on the backend to display data

## Adding a location (WIP)

1. add an export to `index.js` like this: ` exports.refreshAlbertsons = require('./src/handlers/refreshAlbertsons').refreshAlbertsons;`

## Environment variables
heres a large list of various environment variables that are defined in various places. to be turned into better docs later

### Postgres (for each of dev, staging, and production)
host: process.env.DB_HOST,
database: process.env.DB_NAME,
user: process.env.DB_USERNAME,
password: process.env.DB_PASSWORD,

in `getDatabase.js`:
const endpoint = process.env.DB_ENDPOINT;
const key = process.env.DB_KEY;

from serverless.yml:
 DB_ENDPOINT: "${env:DB_ENDPOINT}"
DB_KEY: "${env:DB_KEY}"
GH_TOKEN: "${env:GH_TOKEN}"
CACHE_DIR: /tmp/cache
WALMART_USERNAME: "${env:WALMART_USERNAME}"
WALMART_PASSWORD: "${env:WALMART_PASSWORD}"
SAMS_CLUB_EMAIL: "${env:SAMS_CLUB_EMAIL}"
SAMS_CLUB_PASSWORD: "${env:SAMS_CLUB_PASSWORD}"
DB_USERNAME: "${env:DB_USERNAME}"
DB_PASSWORD: "${env:DB_PASSWORD}"
DB_NAME: "${env:DB_NAME}"
DB_HOST: "${env:DB_HOST}"
PROXY_URL: "${env:PROXY_URL}"

`refreshWebsite.js` process.env.VACCINEFINDERNICKMORG_NAME (seems to be an s3 bucket name/URL)

`findKrogerStores.js`:
username: process.env.KROGER_CLIENT_ID,
password: process.env.KROGER_CLIENT_SECRET,

