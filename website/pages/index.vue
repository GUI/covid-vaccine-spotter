<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" />

    <main class="container-lg">
      <p
        class="lead text-center text-muted py-2 py-lg-4"
        style="padding-bottom: 0px !important"
      >
        {{ description }}
      </p>

      <p class="lead text-center text-muted py-2 sub-lead">
        {{ longDescription }}
      </p>

      <news />

      <div class="row row-cols-1 row-cols-md-3 g-3">
        <div v-for="state in activeStates" :key="state.code" class="col">
          <NuxtLink
            :to="localePath(`/${state.code}/`)"
            class="btn btn-light fw-bold fs-5 text-primary d-block"
            style="border: 1px solid #ddd"
            >{{ state.name }} <font-awesome-icon icon="arrow-alt-circle-right"
          /></NuxtLink>
          <p class="text-center text-secondary mb-0">
            <small>{{
              $t("scanningDetails.scanning", {
                chain_count: state.provider_brand_count,
                store_count: state.store_count,
                state: state.code,
                state_name: state.name,
              })
            }}</small>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  async asyncData({ $http }) {
    const states = Object.freeze(await $http.$get(`/api/v0/states.json`));
    return { states };
  },

  data() {
    return {
      title: this.$t("metadata.title"),
      description: this.$t("metadata.description"),
      longDescription: this.$t("metadata.longDescription"),
      states: [],
    };
  },

  computed: {
    activeStates() {
      return this.states.filter((state) => state.store_count > 0);
    },
  },
};
</script>

<style>
.sub-lead {
  padding-bottom: 0px !important;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  font-size: 1.1rem;
}
</style>
