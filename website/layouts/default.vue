<template comment>
  <div>
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="alert alert-danger rounded-0 unsupported-browser-warning"
      style="display: none"
      v-html="
        $t(
          'Unfortunately, this website is not compatible with your web browser. Sorry!<br />Please <a href=\u0022https://browser-update.org/update-browser.html\u0022>upgrade your browser</a> to use this website.'
        )
      "
    ></div>
    <!-- eslint-enable vue/no-v-html -->
    <Nuxt />
  </div>
</template>

<script>
export default {
  head() {
    return this.$nuxtI18nHead({ addSeoAttributes: true });
  },
};
</script>

<style>
.resp-sharing-button__link,
.resp-sharing-button__icon {
  display: inline-block;
}

.resp-sharing-button__link,
.resp-sharing-button__link:hover {
  text-decoration: none;
  color: #fff;
  margin: 0.5em;
}

.resp-sharing-button {
  border-radius: 5px;
  transition: 25ms ease-out;
  padding: 0.5em 0.75em;
  font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
}

.resp-sharing-button__icon svg {
  width: 1em;
  height: 1em;
  margin-right: 0.4em;
  vertical-align: top;
}

.resp-sharing-button--small svg {
  margin: 0;
  vertical-align: middle;
}

/* Non solid icons get a stroke */
.resp-sharing-button__icon {
  stroke: #fff;
  fill: none;
}

/* Solid icons get a fill */
.resp-sharing-button__icon--solid,
.resp-sharing-button__icon--solidcircle {
  fill: #fff;
  stroke: none;
}

.resp-sharing-button--twitter {
  background-color: #55acee;
}

.resp-sharing-button--twitter:hover {
  background-color: #2795e9;
}

.resp-sharing-button--pinterest {
  background-color: #bd081c;
}

.resp-sharing-button--pinterest:hover {
  background-color: #8c0615;
}

.resp-sharing-button--facebook {
  background-color: #3b5998;
}

.resp-sharing-button--facebook:hover {
  background-color: #2d4373;
}

.resp-sharing-button--tumblr {
  background-color: #35465c;
}

.resp-sharing-button--tumblr:hover {
  background-color: #222d3c;
}

.resp-sharing-button--reddit {
  background-color: #5f99cf;
}

.resp-sharing-button--reddit:hover {
  background-color: #3a80c1;
}

.resp-sharing-button--google {
  background-color: #dd4b39;
}

.resp-sharing-button--google:hover {
  background-color: #c23321;
}

.resp-sharing-button--linkedin {
  background-color: #0077b5;
}

.resp-sharing-button--linkedin:hover {
  background-color: #046293;
}

.resp-sharing-button--email {
  background-color: #777;
}

.resp-sharing-button--email:hover {
  background-color: #5e5e5e;
}

.resp-sharing-button--xing {
  background-color: #1a7576;
}

.resp-sharing-button--xing:hover {
  background-color: #114c4c;
}

.resp-sharing-button--whatsapp {
  background-color: #25d366;
}

.resp-sharing-button--whatsapp:hover {
  background-color: #1da851;
}

.resp-sharing-button--hackernews {
  background-color: #ff6600;
}
.resp-sharing-button--hackernews:hover,
.resp-sharing-button--hackernews:focus {
  background-color: #fb6200;
}

.resp-sharing-button--vk {
  background-color: #507299;
}

.resp-sharing-button--vk:hover {
  background-color: #43648c;
}

.resp-sharing-button--facebook {
  background-color: #3b5998;
  border-color: #3b5998;
}

.resp-sharing-button--facebook:hover,
.resp-sharing-button--facebook:active {
  background-color: #2d4373;
  border-color: #2d4373;
}

.resp-sharing-button--twitter {
  background-color: #55acee;
  border-color: #55acee;
}

.resp-sharing-button--twitter:hover,
.resp-sharing-button--twitter:active {
  background-color: #2795e9;
  border-color: #2795e9;
}

.resp-sharing-button--tumblr {
  background-color: #35465c;
  border-color: #35465c;
}

.resp-sharing-button--tumblr:hover,
.resp-sharing-button--tumblr:active {
  background-color: #222d3c;
  border-color: #222d3c;
}

.resp-sharing-button--email {
  background-color: #777777;
  border-color: #777777;
}

.resp-sharing-button--email:hover,
.resp-sharing-button--email:active {
  background-color: #5e5e5e;
  border-color: #5e5e5e;
}

.resp-sharing-button--pinterest {
  background-color: #bd081c;
  border-color: #bd081c;
}

.resp-sharing-button--pinterest:hover,
.resp-sharing-button--pinterest:active {
  background-color: #8c0615;
  border-color: #8c0615;
}

.resp-sharing-button--linkedin {
  background-color: #0077b5;
  border-color: #0077b5;
}

.resp-sharing-button--linkedin:hover,
.resp-sharing-button--linkedin:active {
  background-color: #046293;
  border-color: #046293;
}

.resp-sharing-button--reddit {
  background-color: #5f99cf;
  border-color: #5f99cf;
}

.resp-sharing-button--reddit:hover,
.resp-sharing-button--reddit:active {
  background-color: #3a80c1;
  border-color: #3a80c1;
}

.resp-sharing-button--whatsapp {
  background-color: #25d366;
  border-color: #25d366;
}

.resp-sharing-button--whatsapp:hover,
.resp-sharing-button--whatsapp:active {
  background-color: #1da851;
  border-color: #1da851;
}

.resp-sharing-button--hackernews {
  background-color: #ff6600;
  border-color: #ff6600;
}

.resp-sharing-button--hackernews:hover .resp-sharing-button--hackernews:active {
  background-color: #fb6200;
  border-color: #fb6200;
}

h2.brand {
  margin-bottom: 0px;
}

.brand-link {
  margin-bottom: 0.5rem;
}

.brand-link a svg {
  margin-left: 4px;
}

html.no-arrow .unsupported-browser-warning {
  display: block !important;
  font-size: 24px;
  line-height: 28px;
  text-align: center;
  font-weight: bold;
}

.location-anchor {
  display: block;
  padding-top: 56px;
  margin-top: -56px;
  z-index: -9999;
}
</style>
