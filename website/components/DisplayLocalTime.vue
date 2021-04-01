<template>
  <span>
    <template v-if="time">
      {{ timeLocale }}
    </template>
    <template v-else> Unknown Time </template>
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
      return this.time.toLocaleString("en-US", {
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
