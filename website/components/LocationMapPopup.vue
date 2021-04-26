<template>
  <div>
    <h6>{{ title }}</h6>
    <p>
      <template v-if="store.properties.address">
        {{ store.properties.address }}<br />
      </template>
      {{ store.properties.city }}, {{ store.properties.state }}
      <template v-if="store.properties.postal_code">
        {{ store.properties.postal_code }}
      </template>
    </p>
    <div>
      <location-details :store="store" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    store: {
      type: Object,
      required: true,
    },
  },

  computed: {
    title() {
      let title = this.store.properties.provider_brand_name;
      if (
        this.store.properties.provider_brand === "centura_driveup_event" ||
        this.store.properties.provider_brand === "comassvax" ||
        this.store.properties.provider_brand === "costco" ||
        this.store.properties.provider_brand === "health_mart"
      ) {
        title += ` - ${this.store.properties.name}`;
      }

      return title;
    },
  },
};
</script>

<style>
.mapboxgl-popup-content {
  font-size: 0.9rem;
}

.mapboxgl-popup-content p {
  line-height: 120%;
}

.mapboxgl-popup-content .location-status.text-success {
  font-size: 1rem;
}

.mapboxgl-popup-content .location-status.text-success svg {
  font-size: 1.5rem;
}

.mapboxgl-popup-close-button {
  font-size: 18px;
  font-weight: bold;
}

.mapboxgl-popup-content .appointment-times {
  max-height: 140px;
  overflow-y: scroll;
}
</style>
