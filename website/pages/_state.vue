<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" with-reload />

    <main>
      <div class="container-lg">
        <p class="lead text-center text-muted py-2 py-lg-4">
          {{ description }}
        </p>

        <div class="row mb-2">
          <div class="col-md-6 pb-3">
            <div class="card card-body h-100 bg-primary text-white shadow-sm">
              <h2 class="display-6 text-center mb-4">
                Step 1: Review your county's availability and
                {{ $store.state.regions.region.metadata.code }}'s eligibility
              </h2>
              <template v-if="state.metadata.code === 'CO'">
                <p class="lead">
                  Visit
                  <a
                    href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated"
                    class="text-white"
                    ><strong class="fw-bold">Colorado.gov</strong></a
                  >
                  for detailed information about your county's vaccine options
                  and review whether or not you are eligible yet.
                </p>
                <p class="lead">
                  You may be able to signup for vaccines with a health care
                  provider in your area (Kaiser, SCL Health, your county, etc.),
                  in which case you will be contacted when it's your turn and
                  you may not need this tool.
                </p>
                <a
                  href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated"
                  class="btn btn-light fw-bold fs-5 text-primary"
                  >Visit Colorado.gov
                  <font-awesome-icon icon="arrow-alt-circle-right"
                /></a>
              </template>
              <template v-else>
                <p class="lead">
                  Be sure to visit your own state's official vaccination website
                  for detailed information about your county's vaccine options
                  and review whether or not you are eligible yet.
                </p>
                <p class="lead">
                  You may be able to signup for vaccines with a health care
                  provider or there may be other options in your area, in which
                  case you may not need this tool.
                </p>
              </template>
            </div>
          </div>
          <div class="col-md-6 pb-3">
            <div class="card card-body h-100 bg-primary text-white shadow-sm">
              <h2 class="display-6 text-center mb-4">
                Step 2: Use this tool to try and find a pharmacy appointment
              </h2>
              <p class="lead">
                If you decide you want to find an appointment at a local
                pharmacy (and are currently eligible for the vaccine), this tool
                might be able to help.
              </p>
              <p class="lead">
                Rather than searching around on each pharmacy's website, we'll
                automatically scan the pharmacy websites and show you any
                available appointments we can find on one page.
              </p>
              <p class="lead">
                All supported locations in {{ state.metadata.name }} are scanned
                on a regular basis and this page is updated with any available
                appointments in the state. If you don't see locations near you
                right now, appointments can come and go quickly so try visiting
                the page at different times throughout the day.
              </p>
            </div>
          </div>
        </div>

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
