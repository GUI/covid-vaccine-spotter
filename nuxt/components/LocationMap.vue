<template>
  <div class="sticky-top sticky-navbar-offset">
    <div id="map" style="width: 100%"></div>
  </div>
</template>

<script>
import { Map, Marker, Popup } from 'maplibre-gl'
// import { escape } from 'html-escaper'
import Vue from 'vue'
import LocationMapPopup from './LocationMapPopup'

export default {
  computed: {
    mapBounds() {
      return this.$store.getters['regions/getMapBounds']
    },

    zipCoords() {
      return this.$store.getters['regions/getMapZipCoords']
    },
  },

  watch: {
    mapBounds() {
      console.info('change mapbounds')
      if (this.map && this.mapBounds) {
        this.map.fitBounds(this.mapBounds, { padding: 10 })
      }
    },

    zipCoords() {
      if (this.zipMarker) {
        if (this.zipCoords) {
          this.zipMarker.setLngLat(this.zipCoords).addTo(this.map)
        } else {
          this.zipMarker.remove()
        }
      }
      console.info('change zipcoords')
    },
  },

  mounted() {
    console.info('getMapBounds: ', this.mapBounds)
    this.map = new Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      bounds: this.mapBounds,
      fitBoundsOptions: {
        padding: 10,
      },
    })

    this.map.on('load', () => {
      const img = new Image(25, 25)
      img.onload = () => {
        console.info('ADD IMAGE')
        this.map.addImage('bus', img, { sdf: true })
      }
      img.src =
        'data:image/svg+xml,%3C%3Fxml version="1.0" encoding="UTF-8"%3F%3E%3Csvg version="1.1" id="marker-15" xmlns="http://www.w3.org/2000/svg" width="15px" height="15px" viewBox="0 0 15 15"%3E%3Cpath id="path4133" d="M7.5,0C5.0676,0,2.2297,1.4865,2.2297,5.2703&%23xA;&%23x9;C2.2297,7.8378,6.2838,13.5135,7.5,15c1.0811-1.4865,5.2703-7.027,5.2703-9.7297C12.7703,1.4865,9.9324,0,7.5,0z"/%3E%3C/svg%3E'
      console.info('img: ', img)

      console.info('LOCATIONS!: ', this.$store.state.regions.region)
      this.map.addSource('locations', {
        type: 'geojson',
        data: this.$store.state.regions.region,
      })

      /*
      this.map.addLayer({
        id: 'locations',
        type: 'symbol',
        source: 'locations',
        layout: {
          'icon-image': 'bus',
          'icon-ignore-placement': true,
          'icon-size': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            1.0,
            'false',
            0.6,
            0.6,
          ],
          'symbol-z-order': 'source',
        },
        paint: {
          'icon-color': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            '#2ca25f',
            'false',
            '#e34a33',
            '#636363',
          ],
        }
      });
      */

      this.zipMarker = new Marker()
      if (this.zipCoords) {
        this.zipMarker.setLngLat(this.zipCoords).addTo(this.map)
      }

      this.map.addLayer({
        id: 'locations',
        type: 'circle',
        source: 'locations',
        paint: {
          'circle-radius': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            0,
            [
              'match',
              ['to-string', ['get', 'appointments_available']],
              'true',
              4,
              'false',
              2,
              2,
            ],
            5,
            [
              'match',
              ['to-string', ['get', 'appointments_available']],
              'true',
              8,
              'false',
              5,
              5,
            ],
            16,
            [
              'match',
              ['to-string', ['get', 'appointments_available']],
              'true',
              16,
              'false',
              10,
              10,
            ],
          ],
          /*
          'circle-radius': {
            base: 5,
            stops: [
              [12, 2],
              [22, 180],
            ],
          },
          */
          /*
          'circle-radius': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            8,
            'false',
            5,
            5,
          ],
          */
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.8,
          'circle-opacity': 0.8,
          'circle-color': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            '#2ca25f',
            'false',
            '#e34a33',
            '#636363',
          ],
        },
      })

      this.map.on('mouseenter', 'locations', () => {
        this.map.getCanvas().style.cursor = 'pointer'
      })

      this.map.on('mouseleave', 'locations', () => {
        this.map.getCanvas().style.cursor = ''
      })

      this.map.on('click', 'locations', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice()
        const store = e.features[0]
        /*
        const description = `
          <div>
            <h6>${escape(store.provider_brand_name)}</h6>
            <p>
              ${escape(store.address)}<br>
              ${escape(store.city)}, ${escape(store.state)} ${escape(
          store.postal_code
        )}
            </p>
            <p>
              Appointments Available: ${(store.appointments_available === true) ? 'Yes' : ((store.appointments_available === false) ? 'No' : 'Unknown')}<br>
              Last Checked: ${(store.appointments_available === true) ? 'Yes' : ((store.appointments_available === false) ? 'No' : 'Unknown')}
            </p>
            <p class="mb-0"><a href="">View Appointment Details</a></p>
          </div>`
          */
        const app = new Vue({
          ...LocationMapPopup,
          propsData: {
            store,
          },
        }).$mount()
        console.info(app)
        const description = app.$el.outerHTML
        console.info(description)

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
        }

        new Popup().setLngLat(coordinates).setHTML(description).addTo(this.map)
      })
    })
  },
}
</script>

<style>
@import 'maplibre-gl/dist/maplibre-gl.css';

.sticky-navbar-offset {
  top: 50px;
}

#map {
  border-width: 1px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.125);
  height: 300px;
  border-radius: 4px;
}

@media (min-width: 992px) {
  #map {
    height: calc(100vh - 50px) !important;
    border-left-width: 0px;
    border-radius: 0px;
  }
}
</style>
