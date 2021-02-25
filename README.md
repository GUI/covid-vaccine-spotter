# covid-vaccine-finder



## Structure
### `provider name` folder
### `findProviderStores.js` handler
### `refreshProvider.js` handler
	seems to be the main one thats exposed in index.js

	this file includes the auth file from the `provider name` folder.
	
	this file creates a class with the same name as the provider and exports a function that logs to the console and awaits a call to the `refreshStores` function inside that class. Theres also other finctions in here for refreshing a single store, fetching days, and fetching slots.

	`refreshStores` seems to pull the data about each store from a database

### Models
These seem to be common class definitions or types used throughout the application


## Steps to Add a location

- add an export to `index.js` like this: ` exports.refreshAlbertsons = require('./src/handlers/refreshAlbertsons').refreshAlbertsons;`

