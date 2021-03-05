<template>
  <div></div>
</template>

<script>
export default {
  async asyncData({ params, $http }) {
    const state = await $http.$get(`/api/v0/states/${params.state}.json`)
    return { state }
  },
}
</script>

<style></style>
