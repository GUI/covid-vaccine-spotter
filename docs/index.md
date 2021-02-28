## Dependencies

package.json specifies `func host start --verbose` as the start command. This seems to come from the `azure-functions-core-tools` package which was not included as a dependency and required an init command to generate `host.json` to make it run. these files are also explicitly `.gitignored` which points to this being the right package

there are also other config files, of which the interesting ones seem to be knexfile.js (a SQL query builder for postgres), `.eleventy.js`, (config for a static site generator), theres also some standard ones for prettier and eslint

seems like there are also a lot of copilot configs from [`copilot-cli`](https://github.com/aws/copilot-cli) for running things on AWS



## Directory structure

### `site`
holds the templates/files that are used to create the frontend

from the eleventy config it also seems like theres meant to be a `site/api/v0` directory, presumably for the scraped data, so it can be served by the site

### `src/provider name` folders
seem to store files the hold functions for auth and actually making the fetches against that provider
### handlers
#### `findProviderStores.js` 
#### `refreshProvider.js`
	seems to be the main one thats exposed in index.js

	this file includes the auth file from the `provider name` folder.
	
	this file creates a class with the same name as the provider and exports a function that logs to the console and awaits a call to the `refreshStores` function inside that class. Theres also other finctions in here for refreshing a single store, fetching days, and fetching slots.

	`refreshStores` seems to pull the data about each store from a database

### Models
These seem to be common class definitions or types used throughout the application

### `/tmp`

`/tmp` seems to be preserved with an empty dotfile so it can be used as the cache on the AWS lambdas server (see the `serverless.yml` config)



## Architecture

It seems as though there are two dockerfiles. one based on node, and one based on microsoft playwright, a "Node.js library to automate Chromium, Firefox and WebKit with a single API".

refresh-website, refresh-cvs, and refresh-albertsons use the regular `Dockerfile`, while sams club, walgreens, and walmart use the `Dockerfile-playwright` one


the func start command seems to spin up a local server of some kind, although its azure devtools so im not sure how necessary it is


### Database

There is a `migrations` folder for maintaining versions of the DB schema and allowing easy upgrade and downgrade. This seems to be managed by the `knex` dependency. 


### Hosting

from the copilot configs and `refreshWebsite.js`, it seems as though the website is hosted out of an S3 bucket. 

`serverless.yml` seems to just be for hosting the postgres database in an `AWS::RDS::DBInstance`

### Backend
What is the role of Azure Functions Core Tools? their docs say it provides "a local development experience for creating, developing, testing, running, and debugging Azure Functions." but nothing else here seems to use azure functions