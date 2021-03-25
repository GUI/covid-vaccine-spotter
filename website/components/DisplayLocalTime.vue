<template>
  <span>
    <template v-if="time">
      <local-time
        time-zone-name="short"
        month="long"
        day="numeric"
        year="numeric"
        hour="numeric"
        minute="numeric"
        >{{ timeLocale }}</local-time
      >
    </template>
    <template v-else> {{ $t("time.unknown") }} </template>
  </span>
</template>

<script>
export default {
  props: {
    time: {
      type: Date,
      default: null,
    },
    timeZone: {
      type: String,
      default: null,
    },
  },

  computed: {
    timeISO() {
      return this.time.toISOString();
    },

    timeLocale() {
      return this.time.toLocaleString(this.$root.$i18n.localeProperties.iso, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
        timeZone: this.timeZone || "America/New_York",
      });
    },
  },
};
</script>

<style></style>
