<template>
  <div>
    <social-head
      :title="$t('_state.title', { state: usStateName })"
      :description="
        $t('_state.description', {
          state: usStateName,
        })
      "
    />

    <navbar :title="$t('_state.title', { state: usStateName })" with-reload />

    <main>
      <div class="container-lg">
        <p class="lead text-center text-muted py-2 py-lg-4">
          {{
            $t("_state.description", {
              state: usStateName,
            })
          }}
        </p>

        <div class="row mb-2">
          <div class="col-md-6 pb-3">
            <div class="card card-body h-100 bg-primary text-white shadow-sm">
              <h2 class="display-6 text-center mb-4">
                {{
                  $t("steps.0.header", {
                    state: usStateCode,
                    state_name: usStateName,
                  })
                }}
              </h2>
              <template v-if="usStateCode === 'CO'">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <p class="lead" v-html="$t('steps.0.colorado')" />
                <p class="lead">
                  {{ $t("steps.0.localProvider") }}
                </p>
                <a
                  href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated"
                  class="btn btn-light fw-bold fs-5 text-primary"
                  >{{ $t("steps.0.visitColorado") }}
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
                {{ text.replace("{state_name}", usStateName) }}
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
              <div v-if="$fetchState.pending">Fetching data...</div>
              <div
                v-else-if="$fetchState.error"
                class="alert alert-danger"
                role="alert"
              >
                Error fetching data: {{ $fetchState.error.message }}<br />If
                this error persists, this is not expected, so please contact me
                at
                <a
                  href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
                  >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
                >.
              </div>
              <div
                v-else-if="filteredLocationsError"
                class="alert alert-danger"
                role="alert"
              >
                {{ filteredLocationsError }}
              </div>
              <div
                v-else-if="filteredLocationsCount === 0"
                class="alert alert-warning"
                role="alert"
              >
                {{ $t("searchBar.noResults") }}
              </div>

              <store
                v-for="store in filteredLocationsPage"
                :key="store.properties.id"
                :store="store"
              ></store>

              <location-pagination
                :total-results="filteredLocationsCount"
                @per-page="paginatePerPageChange"
                @page="paginatePageChange"
              ></location-pagination>
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
  fetchOnServer: false,
  fetchDelay: 5,

  data() {
    return {
      page: 1,
      perPage: 25,
    };
  },

  async fetch() {
    try {
      if (this?.$nuxt?.$loading?.start) {
        this.$nuxt.$loading.start();
      }

      const state = this.$route.params.state.toUpperCase();
      const usStatePromise = this.$http.$get(`/api/v0/states/${state}.json`);
      const postalCodesPromise = this.$http.$get(
        `/api/v0/states/${state}/postal_codes.json`
      );

      const usState = Object.freeze(await usStatePromise);
      const postalCodes = Object.freeze(await postalCodesPromise);

      this.$store.commit("usStates/set", usState);
      this.$store.commit("postalCodes/set", postalCodes);

      if (this?.$nuxt?.$loading?.finish) {
        this.$nuxt.$loading.finish();
      }
    } catch (error) {
      if (this.$rollbar) {
        this.$rollbar.error(error);
      }

      throw error;
    }
  },

  computed: {
    usState() {
      return this.$store.state.usStates.usState;
    },

    usStateCode() {
      return this.usState?.metadata?.code;
    },

    usStateName() {
      return this.usState?.metadata?.name;
    },

    title() {
      return `${this.usStateName || ""} COVID-19 Vaccine Spotter`;
    },

    description() {
      return `A tool to help you track down COVID-19 vaccine appointment openings at ${
        this.usStateName || ""
      } pharmacies. Updated every minute.`;
    },

    filteredLocationsPage() {
      const startIndex = (this.page - 1) * this.perPage;
      const endIndex = this.page * this.perPage;
      return this.$store.getters["usStates/getFilteredLocations"].slice(
        startIndex,
        endIndex
      );
    },

    filteredLocationsError() {
      return this.$store.getters["usStates/getFilterError"];
    },

    filteredLocationsCount() {
      const locations = this.$store.getters["usStates/getFilteredLocations"];
      return locations ? locations.length : 0;
    },
  },

  methods: {
    paginatePerPageChange(perPage) {
      this.perPage = perPage;
    },

    paginatePageChange(page) {
      if (page !== this.page) {
        this.page = page;
        this.$nextTick(() => {
          const anchor = document.querySelector(
            ".results-container .location-anchor"
          );
          if (anchor) {
            anchor.scrollIntoView();
          }
        });
      }
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
