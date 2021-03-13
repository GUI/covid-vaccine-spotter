# COVID-19 Vaccine Spotter

A tool to help you track down COVID-19 vaccine appointment openings at your state's pharmacies. The code behind https://www.vaccinespotter.org.

## UI Development Setup

Requirements:

- Node.js 14+
- Yarn

This process is clunky right now, so my apologies.

1. Clone the repo: `git clone https://github.com/GUI/covid-vaccine-spotter.git`
2. Install dependencies (inside the repo): `yarn install`
3. Download data from the [API](https://www.vaccinespotter.org/api/) for the website to run. Note these example steps just download a few files to get things running, but it's not an entire dataset. You can download other states data, but I know this is currently a bit cumbersome.
   - `mkdir -p website/static/api/v0/states/CO`
   - `curl -o website/static/api/v0/states.json https://www.vaccinespotter.org/api/v0/states.json`
   - `curl -o website/static/api/v0/states/CO.json https://www.vaccinespotter.org/api/v0/states/CO.json`
   - `curl -o website/static/api/v0/states/CO/postal_codes.json https://www.vaccinespotter.org/api/v0/states/CO/postal_codes.json`
4. To run the development server for the website: `yarn run dev`. The development site should then be available at http://localhost:3000/.

## DB and Backend Development Setup

docker-compose is used to bring up a local postgres DB. Then an image runs to bootstrap the database with states and postal codes. Finally, as an example of a backend task running, a container runs the `refresh-website` task.

```
docker-compose build
docker-compose up
```

To run additional tasks, you can use `docker-compose run`:

```
docker-compose run --no-deps task_runner bin/refresh-cvs
```

## Very Beta API

All of the data being collected is published as JSON files here: https://www.vaccinespotter.org/api/

Subscribe to this discussion for any announcement of API changes: https://github.com/GUI/covid-vaccine-spotter/discussions/27
