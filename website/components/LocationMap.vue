<template>
  <div class="sticky-top sticky-navbar-offset">
    <div id="map" style="width: 100%"></div>
    <div id="legend" class="map-overlay">
      <div>
        <img src="~/assets/map-icon-circle.svg?data" alt="" /> Appointments
        recently available
      </div>
      <div>
        <img src="~/assets/map-icon-diamond.svg?data" alt="" /> Appointments not
        available
      </div>
      <div>
        <img src="~/assets/map-icon-square.svg?data" alt="" /> Appointment
        status unknown
      </div>
    </div>
  </div>
</template>

<script>
import { Map, Marker, Popup } from "maplibre-gl";
import Vue from "vue";
import LocationMapPopup from "./LocationMapPopup.vue";
import mapIconCircle from "~/assets/map-icon-circle.svg?data";
import mapIconDiamond from "~/assets/map-icon-diamond.svg?data";
import mapIconSquare from "~/assets/map-icon-square.svg?data";

export default {
  computed: {
    mapBounds() {
      return this.$store.getters["usStates/getMapBounds"];
    },

    zipCoords() {
      return this.$store.getters["usStates/getMapZipCoords"];
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

    const mapIconCircleImg = new Image(36, 36);
    mapIconCircleImg.onload = () =>
      this.map.addImage("icon-circle", mapIconCircleImg);
    mapIconCircleImg.src = mapIconCircle;

    const mapIconDiamondImg = new Image(36, 36);
    mapIconDiamondImg.onload = () =>
      this.map.addImage("icon-diamond", mapIconDiamondImg);
    mapIconDiamondImg.src = mapIconDiamond;

    const mapIconSquareImg = new Image(36, 36);
    mapIconSquareImg.onload = () =>
      this.map.addImage("icon-square", mapIconSquareImg);
    mapIconSquareImg.src = mapIconSquare;

    this.map.on("load", () => {
      const stateData = this.$store.state.usStates.usState;
      stateData.features.splice(
        0,
        stateData.features.length,
        ...stateData.features.filter(
          (feature) => feature.geometry.coordinates[0] != null
        )
      );
      stateData.metadata.store_count = stateData.features.length;
      this.map.addSource("locations", {
        type: "geojson",
        data: stateData,
      });

      this.zipMarker = new Marker();
      if (this.zipCoords) {
        this.zipMarker.setLngLat(this.zipCoords).addTo(this.map);
      }

      this.map.addLayer({
        id: "locations",
        source: "locations",
        type: "symbol",
        layout: {
          "icon-image": [
            "match",
            ["to-string", ["get", "appointments_available_all_doses"]],
            "true",
            "icon-circle",
            "false",
            "icon-diamond",
            "icon-square",
          ],
          "icon-ignore-placement": true,
          "icon-allow-overlap": true,
          "icon-size": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            0,
            [
              "match",
              ["to-string", ["get", "appointments_available_all_doses"]],
              "true",
              0.25,
              "false",
              0.125,
              0.125,
            ],
            5,
            [
              "match",
              ["to-string", ["get", "appointments_available_all_doses"]],
              "true",
              0.5,
              "false",
              0.3125,
              0.3125,
            ],
            16,
            [
              "match",
              ["to-string", ["get", "appointments_available_all_doses"]],
              "true",
              1.0,
              "false",
              0.625,
              0.625,
            ],
          ],
          "symbol-z-order": "source",
        },
        paint: {
          "icon-opacity": 0.8,
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
  height: 67px;
  width: 210px;
  font-size: 0.75rem;
  top: 0px;
  margin-top: 5px;
}

#legend img {
  opacity: 0.8;
}

@media (min-width: 992px) {
  #map {
    height: calc(100vh - 54px) !important;
    border-left-width: 0px;
    border-radius: 0px;
  }
}
</style>
