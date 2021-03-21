<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" with-reload />

    <main>
      <div class="container-lg">
        <p class="lead text-center text-muted py-2 py-lg-4">
          {{ description }}
        </p>

        <quick-steps />

        <news />

        <location-filters-form />
      </div>
      <div class="container-fluid container-lg-no-padding">
        <div class="row g-3 g-lg-0">
          <div class="col-lg-6 col-map">
            <location-map />
          </div>
          <div class="col-lg-6 col-list">
            <div class="results-container">
              <div
                v-show="filteredLocationsError"
                class="alert alert-danger"
                role="alert"
              >
                {{ filteredLocationsError }}
              </div>
              <div
                v-show="filteredLocations.length === 0"
                class="alert alert-warning"
                role="alert"
              >
                No open appointments for your search can currently be found. Try
                expanding your search or check again later (appointments can
                come and go quickly).
              </div>

              <store
                v-for="store in filteredLocations"
                :key="store.properties.id"
                :store="store"
              ></store>
            </div>
          </div>
        </div>
      </div>
      <div class="container-lg mt-3">
        <tool-status />
      </div>
    </main>
  </div>
</template>

<script>
export default {
  async asyncData({ params, store, $store, $http }) {
    const state = Object.freeze(
      await $http.$get(`/api/v0/states/${params.state}.json`)
    );
    const postalCodes = Object.freeze(
      await $http.$get(`/api/v0/states/${params.state}/postal_codes.json`)
    );

    store.commit("regions/set", state);
    store.commit("postalCodes/set", postalCodes);

    return {
      state,
      postalCodes,
      title: `${state.metadata.name} COVID-19 Vaccine Spotter`,
      description: `A tool to help you track down COVID-19 vaccine appointment openings at ${state.metadata.name} pharmacies. Updated every minute.`,
    };
  },

  computed: {
    filteredLocations() {
      return this.$store.getters["regions/getFilteredLocations"];
    },

    filteredLocationsError() {
      return this.$store.state.regions.filterError;
    },
  },
};
</script>

<style>
@media (min-width: 992px) {
  .container-lg-no-padding {
    padding: 0px !important;
  }

  .container-lg-no-padding > .row {
    margin-left: 0px !important;
    margin-right: 0px !important;
  }

  .container-lg-no-padding > .row > .col-map {
    padding-right: 0.5rem;
  }

  .container-lg-no-padding > .row > .col-list {
    padding-left: 0.5rem;
    padding-right: 1rem;
  }
}

.results-container .location-result:last-child {
  margin-bottom: 0px !important;
}
</style>
