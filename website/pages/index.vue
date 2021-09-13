<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" />

    <main class="container-lg">
      <top-content :description="description" />

      <p class="lead text-center text-muted my-2 mb-3 sub-lead">
        {{
          $t(
            "Rather than searching around on each pharmacy's website, we'll automatically scan the pharmacy websites and show you any available appointments we can find on one page."
          )
        }}
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
              $t(
                "Scanning {chain_count} pharmacy chains ({store_count} stores) in {state}",
                {
                  chain_count: state.provider_brand_count,
                  store_count: state.store_count,
                  state: state.code,
                  state_name: state.name,
                }
              )
            }}</small>
          </p>
        </div>
      </div>
    </main>

    <footer-content />
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
      title: this.$t("Vaccine Spotter"),
      description: this.$t(
        "A tool to help you track down COVID-19 vaccine appointment openings at your state's pharmacies. Updated every minute."
      ),
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
