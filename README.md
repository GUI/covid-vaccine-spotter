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

## LICENSE
Copyright (c) 2021 Nick Muerdter

MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
