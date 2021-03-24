<template>
  <div class="alert alert-info" role="alert">
    <p class="mb-0">
      <strong>{{ $t("news.date") }}:</strong>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span v-html="$t('news.message')"></span>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span v-html="$t('news.suffix')"></span>
    </p>
  </div>
</template>

<script></script>

<style></style>
