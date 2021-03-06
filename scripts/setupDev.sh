#!/bin/bash

mkdir -p site/api/v0/stores/CO
curl -o site/api/v0/states.json https://www.vaccinespotter.org/api/v0/states.json
curl -o site/api/v0/stores/CO/cvs.json https://www.vaccinespotter.org/api/v0/stores/CO/cvs.json
curl -o site/api/v0/stores/CO/walgreens.json https://www.vaccinespotter.org/api/v0/stores/CO/walgreens.json
curl -o site/api/v0/stores/CO/walmart.json https://www.vaccinespotter.org/api/v0/stores/CO/walmart.json
