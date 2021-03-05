<template>
  <div>
    <p
      class="lead text-center text-muted py-lg-4"
      style="padding-bottom: 0px !important"
    >
      DESCRIPTION
    </p>

    <p
      class="lead text-center text-muted py-lg-4"
      style="
        padding-bottom: 0px !important;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        font-size: 1.1rem;
      "
    >
      Rather than searching around on each pharmacy's website, we'll
      automatically scan the pharmacy websites and show you any available
      appointments we can find on one page.
    </p>

    <div class="alert alert-info my-4" role="alert">
      <p class="mb-0">
        <strong>03/03/2021:</strong> <strong>Thrifty White</strong> locations
        are now being scanned in all supported states (Iowa, Minnesota, and
        North Dakota). 🥳 Hope these additional locations help you! Any feedback
        is welcome:
        <a
          href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
          >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
        >
        or <a href="https://twitter.com/nickblah">@nickblah</a>. And if you're a
        coder and have interest in helping out on
        <a href="https://github.com/GUI/covid-vaccine-finder/issues">GitHub</a>,
        that would be dandy (although the code's still messy)!
      </p>
    </div>

    <div class="row row-cols-1 row-cols-md-3 g-3">
      <div v-for="state in activeStates" :key="state.code" class="col">
        <NuxtLink
          :to="`/${state.code}`"
          class="btn btn-light fw-bold fs-5 text-primary d-block"
          style="border: 1px solid #ddd"
          >{{ state.name }} <i class="fas fa-arrow-alt-circle-right"></i
        ></NuxtLink>
        <p class="text-center text-secondary mb-0">
          <small
            >Scanning {{ state.provider_brand_count }} pharmacy chains ({{
              state.store_count
            }}
            stores) in {{ state.code }}</small
          >
        </p>
      </div>
    </div>
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
