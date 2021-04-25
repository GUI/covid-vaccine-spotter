<template>
  <div>
    <div class="row my-2 my-lg-4">
      <div class="col">
        <p
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
  },

  methods: {
    switchLanguage() {
      const newLocale = this.$i18n.locale === "en" ? "es" : "en";
      this.$i18n.setLocale(newLocale);
      this.$forceUpdate();
    },
  },
};
</script>

<style></style>
