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

      <div class="alert alert-danger my-4" role="alert">
        <p>
          {{ $t("api.blockText") }}
          <a href="https://github.com/GUI/covid-vaccine-finder/issues">{{
            $t("contact.github")
          }}</a
          >,
          <a
            href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
            >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
          >, {{ $t("api.or") }}
          <a href="https://twitter.com/nickblah">{{
            $t("contact.twitterHandle")
          }}</a
          >.
        </p>
        <p class="mb-0">
          {{ $t("api.changelog.beforeLink") }}
          <a
            href="https://github.com/GUI/covid-vaccine-spotter/discussions/27"
            >{{ $t("api.changelog.linkText") }}</a
          >
          {{ $t("api.changelog.afterLink") }}
        </p>
      </div>

      <ul>
        <li>
          <code><a :href="`/api/v0/states.json`">/api/v0/states.json</a></code>
        </li>
        <li v-for="state in activeStates" :key="state.code">
          <code
            ><a :href="`/api/v0/states/${state.code}.json`"
              >/api/v0/states/{{ state.code }}.json</a
            ></code
          >
        </li>
      </ul>
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
      title: this.$t("api.title"),
      description: this.$t("api.description"),
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

<style></style>
