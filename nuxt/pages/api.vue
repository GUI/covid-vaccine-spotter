<template>
  <div class="container-lg">
    <div class="alert alert-danger my-4" role="alert">
      <p class="mb-0">
        Here's all of the underlying data in JSON format used for this tool.
        Things are moving fast, so this is subject to change. So while I'm
        hesitant to call this any type of stable API, I wanted to at least share
        what I have. If you do use this data just note that things may change.
        Feel free to reach out to let me know you're using this, so I can maybe
        give you a heads up about breaking changes:
        <a href="https://github.com/GUI/covid-vaccine-finder/issues">GitHub</a>,
        <a
          href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
          >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
        >, or <a href="https://twitter.com/nickblah">@nickblah</a>.
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
  </div>
</template>

<script>
export default {
  async asyncData({ $http }) {
    const states = await $http.$get('/api/v0/states.json')
    return { states }
  },

  data() {
    return {
      states: [],
    }
  },

  computed: {
    activeStates() {
      return this.states.filter((state) => state.store_count > 0)
    },
  },
}
</script>

<style></style>
