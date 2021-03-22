<template>
  <div class="sticky-top sticky-navbar-offset">
    <div id="map" style="width: 100%"></div>
    <div id="legend" class="map-overlay">
      <div>
        <span class="available-marker"></span> Appointments recently available
      </div>
      <div>
        <span class="unavailable-marker"></span> Appointments not available
      </div>
      <div><span class="unknown-marker"></span> Appointment status unknown</div>
    </div>
  </div>
</template>

<script>
import { Map, Marker, Popup } from "maplibre-gl";
import Vue from "vue";
import LocationMapPopup from "./LocationMapPopup.vue";

export default {
  computed: {
    mapBounds() {
      return this.$store.getters["regions/getMapBounds"];
    },

    zipCoords() {
      return this.$store.getters["regions/getMapZipCoords"];
    },
  },

  watch: {
    mapBounds() {
      if (this.map && this.mapBounds) {
        this.map.fitBounds(this.mapBounds, { padding: 10 });
      }
    },

    zipCoords() {
      if (this.zipMarker) {
        if (this.zipCoords) {
          this.zipMarker.setLngLat(this.zipCoords).addTo(this.map);
        } else {
          this.zipMarker.remove();
        }
      }
    },
  },

  mounted() {
    this.map = new Map({
      container: "map",
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      bounds: this.mapBounds,
      fitBoundsOptions: {
        padding: 10,
      },
    });

    this.map.on("load", () => {
      this.map.addSource("locations", {
        type: "geojson",
        data: this.$store.state.regions.region,
      });

      this.zipMarker = new Marker();
      if (this.zipCoords) {
        this.zipMarker.setLngLat(this.zipCoords).addTo(this.map);
      }

      this.map.addLayer({
        id: "locations",
        type: "circle",
        source: "locations",
        paint: {
          "circle-radius": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            0,
            [
              "match",
              ["to-string", ["get", "appointments_available"]],
              "true",
              4,
              "false",
              2,
              2,
            ],
            5,
            [
              "match",
              ["to-string", ["get", "appointments_available"]],
              "true",
              8,
              "false",
              5,
              5,
            ],
            16,
            [
              "match",
              ["to-string", ["get", "appointments_available"]],
              "true",
              16,
              "false",
              10,
              10,
            ],
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.8,
          "circle-opacity": 0.8,
          "circle-color": [
            "match",
            ["to-string", ["get", "appointments_available"]],
            "true",
            "#2ca25f",
            "false",
            "#e34a33",
            "#636363",
          ],
        },
      });

      this.map.on("mouseenter", "locations", () => {
        this.map.getCanvas().style.cursor = "pointer";
      });

      this.map.on("mouseleave", "locations", () => {
        this.map.getCanvas().style.cursor = "";
      });

      this.map.on("click", "locations", (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const store = e.features[0];
        const app = new Vue({
          ...LocationMapPopup,
          propsData: {
            store,
          },
        }).$mount();
        const description = app.$el.outerHTML;

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new Popup({ maxWidth: "400px" })
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(this.map);
      });
    });
  },
};
</script>

<style>
@import "maplibre-gl/dist/maplibre-gl.css";

.sticky-navbar-offset {
  top: 54px;
}

#map {
  border-width: 1px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.125);
  height: 300px;
  border-radius: 4px;
}

.map-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  margin-right: 5px;
  font-family: Arial, sans-serif;
  overflow: auto;
  border-radius: 3px;
}

#legend {
  padding: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  line-height: 16px;
  height: 64px;
  width: 210px;
  font-size: 0.75rem;
  top: 0px;
  margin-top: 5px;
}

#legend span {
  height: 14px;
  width: 14px;
  vertical-align: middle;
  margin-top: -2px;
  background-color: #bbb;
  border-radius: 50%;
  display: inline-block;
  border: 1px solid #fff;
  opacity: 0.8;
}

#legend span.available-marker {
  background-color: #2ca25f;
}

#legend span.unavailable-marker {
  background-color: #e34a33;
  width: 7px;
}

#legend span.unknown-marker {
  background-color: #636363;
}

@media (min-width: 992px) {
  #map {
    height: calc(100vh - 54px) !important;
    border-left-width: 0px;
    border-radius: 0px;
  }
}
</style>
