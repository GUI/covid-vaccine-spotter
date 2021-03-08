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
          Here's all of the underlying data in JSON format used for this tool.
          Things are moving fast, so this is subject to change. So while I'm
          hesitant to call this any type of stable API, I wanted to at least
          share what I have. If you do use this data just note that things may
          change. Feel free to reach out to let me know you're using this, so I
          can maybe give you a heads up about breaking changes:
          <a href="https://github.com/GUI/covid-vaccine-finder/issues">GitHub</a
          >,
          <a
            href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
            >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
          >, or <a href="https://twitter.com/nickblah">@nickblah</a>.
        </p>
        <p class="mb-0">
          Subscribe to the
          <a href="https://github.com/GUI/covid-vaccine-spotter/discussions/27"
            >API Changelog</a
          >
          discussion on GitHub for announcements on any API changes or
          additions.
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
      title: "Very Beta API | COVID-19 Vaccine Spotter",
      description:
        "The machine readable data behind the COIVD-19 Vaccine Spotter tool. Very beta.",
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
