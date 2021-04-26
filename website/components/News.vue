<template>
  <div>
    <div
      v-show="newsVisible"
      class="alert alert-info alert-dismissible"
      role="alert"
    >
      <p class="mb-0">
        <strong>{{ formattedDate }}:</strong>
        <!-- eslint-disable vue/no-v-html -->
        <span
          v-html="
            $t(
              'Thanks to the developer community, Vaccine Spotter is now available in Spanish! 💫 There may still be a few gaps, but most of it should be translated. I\'ve also made some other tweaks to hopefully make the site easier to navigate and use.'
            )
          "
        />
        <span
          v-html="
            $t(
              'Any feedback is welcome: <a href=\u0022m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org\u0022>vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a> or <a href=\u0022https://twitter.com/nickblah\u0022>@nickblah</a>. And if you\'re a coder and have interest in helping out on <a href=\u0022https://github.com/GUI/covid-vaccine-finder/issues\u0022>GitHub</a>, that would be dandy (although the code\'s still messy)!'
            )
          "
        />
        <!-- eslint-enable vue/no-v-html -->
      </p>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        @click="hideNews"
      ></button>
    </div>
  </div>
</template>

<script>
import { DateTime } from "luxon";

export default {
  data() {
    return {
      date: DateTime.utc(2021, 4, 26),
    };
  },

  computed: {
    formattedDate() {
      return this.date
        .setLocale(this.$i18n.localeProperties.iso)
        .toLocaleString(DateTime.DATE_SHORT);
    },

    newsVisible() {
      if (!this.$store.state.news.hiddenTime) {
        return true;
      }

      return this.$store.state.news.hiddenTime < this.date.toISO();
    },
  },

  methods: {
    hideNews() {
      this.$store.commit("news/setHiddenTime", this.date.toISO());
    },
  },
};
</script>

<style></style>
