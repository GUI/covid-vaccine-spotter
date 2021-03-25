<template>
  <div>
    <social-head
      :title="
        $t('_state.title', { state: $store.state.regions.region.metadata.name })
      "
      :description="
        $t('_state.description', {
          state: $store.state.regions.region.metadata.name,
        })
      "
    />

    <navbar
      :title="
        $t('_state.title', { state: $store.state.regions.region.metadata.name })
      "
      with-reload
    />

    <main>
      <div class="container-lg">
        <p class="lead text-center text-muted py-2 py-lg-4">
          {{
            $t("_state.description", {
              state: $store.state.regions.region.metadata.name,
            })
          }}
        </p>

        <div class="row mb-2">
          <div class="col-md-6 pb-3">
            <div class="card card-body h-100 bg-primary text-white shadow-sm">
              <h2 class="display-6 text-center mb-4">
                {{
                  $t("steps.0.header", {
                    state: $store.state.regions.region.metadata.code,
                  })
                }}
              </h2>
              <template v-if="state.metadata.code === 'CO'">
                <p class="lead" v-html="$t('steps.0.colorado')" />
                <p class="lead">
                  {{ $t("steps.0.localProvider") }}
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
                  {{ $t("steps.0.eligibility") }}
                </p>
                <p class="lead">
                  {{ $t("steps.0.localProvider") }}
                </p>
              </template>
            </div>
          </div>
          <div class="col-md-6 pb-3">
            <div class="card card-body h-100 bg-primary text-white shadow-sm">
              <h2 class="display-6 text-center mb-4">
                {{ $t("steps.1.header") }}
              </h2>
              <p v-for="text in $t('steps.1.text')" :key="text" class="lead">
                {{
                  text.replace(
                    "{name}",
                    $store.state.regions.region.metadata.name
                  )
                }}
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
                {{ $t("searchBar.noResults") }}
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
