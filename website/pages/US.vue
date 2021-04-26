<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" :us-state-param="$route.params.state" with-reload />

    <main>
      <div class="container-lg">
        <top-content :description="description" />

        <div class="alert alert-danger">
          This US-wide map view is for testing purposes only. Performance is
          likely going to be slow to load the map.
        </div>
      </div>
      <div class="container-fluid">
        <div class="row g-3 g-lg-0">
          <div class="col-lg-12">
            <div class="mx-3">
              <location-map />
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

  async fetch() {
    try {
      if (this?.$nuxt?.$loading?.start) {
        this.$nuxt.$loading.start();
      }

      const usStatePromise = this.$http.$get(`/api/v0/US.json`);

      const usState = Object.freeze(await usStatePromise);

      this.$store.commit("usStates/set", usState);

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
      return this.$t("{state} Vaccine Spotter", {
        state: this.usStateName || "",
      });
    },

    description() {
      return `A tool to help you track down COVID-19 vaccine appointment openings at ${
        this.usStateName || ""
      } pharmacies. Updated every minute.`;
    },
  },
};
</script>

<style></style>
