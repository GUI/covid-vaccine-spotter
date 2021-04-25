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
    iso: {
      type: String,
      default: "en-US",
    },
  },

  computed: {
    timeISO() {
      return this.time.toISOString();
    },

    timeLocale() {
      // console.log(this.$i18n);
      return this.time.toLocaleString(this.iso, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
      });
    },
  },
};
</script>

<style></style>
