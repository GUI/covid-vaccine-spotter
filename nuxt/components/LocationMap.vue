<template>
  <div class="sticky-top sticky-navbar-offset">
    <div id="map" style="width: 100%"></div>
  </div>
</template>

<script>
import { Map, Marker, Popup } from 'maplibre-gl'
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
    },
  },

  mounted() {
    this.map = new Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      bounds: this.mapBounds,
      fitBoundsOptions: {
        padding: 10,
      },
    })

    this.map.on('load', () => {
      this.map.addSource('locations', {
        type: 'geojson',
        data: this.$store.state.regions.region,
      })

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
        const app = new Vue({
          ...LocationMapPopup,
          propsData: {
            store,
          },
        }).$mount()
        const description = app.$el.outerHTML

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
        }

        new Popup({ maxWidth: '400px' })
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(this.map)
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
