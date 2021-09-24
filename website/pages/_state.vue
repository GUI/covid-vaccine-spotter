<template>
  <div></div>
</template>

<script>
export default {
  head: {
    link: [{ rel: "canonical", href: "/shutdown/" }],
    meta: [
      { "http-equiv": "refresh", content: "0; url=/shutdown/" },
      { name: "robots", content: "noindex,follow" },
      { "http-equiv": "cache-control", content: "no-cache" },
    ],
  },
};
</script>

<style>
@media (min-width: 992px) {
  .container-lg-no-padding {
    padding: 0px !important;
  }

  .container-lg-no-padding > .row {
    margin-left: 0px !important;
    margin-right: 0px !important;
  }

  .container-lg-no-padding > .row > .col-map {
    padding-right: 0.5rem;
  }

  .container-lg-no-padding > .row > .col-list {
    padding-left: 0.5rem;
    padding-right: 1rem;
  }
}

.results-container .location-result:last-child {
  margin-bottom: 0px !important;
}
</style>
