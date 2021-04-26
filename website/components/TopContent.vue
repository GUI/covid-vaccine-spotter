<template>
  <div>
    <div
      :class="{
        row: true,
        'my-2': true,
        'my-lg-4': !toggleInstructions || instructionsVisible,
      }"
    >
      <div class="col">
        <div
          v-show="toggleInstructions && !instructionsVisible"
          class="text-center instructions-toggle"
        >
          <button
            class="btn btn-link btn-sm"
            type="button"
            @click="showInstructions"
          >
            {{ $t("Show instructions") }}
          </button>
        </div>
        <p
          v-show="!toggleInstructions || instructionsVisible"
          class="lead text-center text-muted my-0"
          style="padding-bottom: 0px !important"
        >
          {{ description }}
        </p>
      </div>
      <div class="col-auto">
        <div class="btn btn-outline-secondary btn-sm" @click="switchLanguage">
          {{ $i18n.locale == "en" ? "Español" : "English" }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    description: {
      type: String,
      required: true,
    },

    toggleInstructions: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    instructionsVisible() {
      return this.$store.state.instructions.visible;
    },
  },

  methods: {
    switchLanguage() {
      const newLocale = this.$i18n.locale === "en" ? "es" : "en";
      this.$i18n.setLocale(newLocale);
      this.$forceUpdate();
    },

    showInstructions() {
      this.$store.commit("instructions/setVisible", true);
      this.$store.commit("news/setHiddenTime", null);
    },
  },
};
</script>

<style></style>
