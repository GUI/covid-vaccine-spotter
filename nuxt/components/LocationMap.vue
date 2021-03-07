<template>
  <div class="sticky-top sticky-navbar-offset">
    <div id="map" class="vh-100" style="width: 100%"></div>
  </div>
</template>

<script>
import { Map } from 'maplibre-gl'

export default {
  mounted() {
    this.map = new Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [0, 0],
      zoom: 1,
    })

    this.map.on('load', () => {
      console.info('LOCATIONS!: ', this.$store.state.regions.region)
      this.map.addSource('locations', {
        type: 'geojson',
        data: this.$store.state.regions.region,
      })

      this.map.addLayer({
        id: 'locations',
        type: 'circle',
        source: 'locations',
        paint: {
          'circle-radius': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            8,
            'false',
            5,
            /* other */ 5,
          ],
          'circle-stroke-color': '#333333',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.8,
          'circle-opacity': 0.8,
          'circle-color': [
            'match',
            ['to-string', ['get', 'appointments_available']],
            'true',
            '#2ca25f',
            'false',
            '#e34a33',
            /* other */ '#636363',
          ],
        },
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

.sticky-navbar-offset .vh-100 {
  height: calc(100vh - 50px) !important;
}
</style>
