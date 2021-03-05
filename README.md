# COVID-19 Vaccine Spotter

A tool to help you track down COVID-19 vaccine appointment openings at your state's pharmacies. The code behind https://www.vaccinespotter.org.

## Development Setup

Requirements:

- Node.js 14+
- Yarn

This process is clunky right now, so my apologies.

1. Clone the repo: `git clone https://github.com/GUI/covid-vaccine-spotter.git`
2. Install dependencies (inside the repo): `yarn install`
3. Download data from the [API](https://www.vaccinespotter.org/api/) for the website to run. Note these example steps just download a few files to get things running, but it's not an entire dataset. You can download other states data, but I know this is currently a bit cumbersome.
   - `mkdir -p site/api/v0/stores/CO`
   - `curl -o site/api/v0/states.json https://www.vaccinespotter.org/api/v0/states.json`
   - `curl -o site/api/v0/stores/CO/cvs.json https://www.vaccinespotter.org/api/v0/stores/CO/cvs.json`
   - `curl -o site/api/v0/stores/CO/walgreens.json https://www.vaccinespotter.org/api/v0/stores/CO/walgreens.json`
   - `curl -o site/api/v0/stores/CO/walmart.json https://www.vaccinespotter.org/api/v0/stores/CO/walmart.json`
4. To run the development server for the website: `yarn run eleventy --serve`. The development site should then be available at http://localhost:8080/.

TODO: While this should cover running the website with existing, this doesn't cover running the database and other pieces necessary for working on the scanners or other backend pieces. Still need to document that part.

## Very Beta API

All of the data being collected is published as JSON files here: https://www.vaccinespotter.org/api/

Subscribe to this discussion for any announcement of API changes: https://github.com/GUI/covid-vaccine-spotter/discussions/27
