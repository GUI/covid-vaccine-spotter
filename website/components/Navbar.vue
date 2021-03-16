<template>
  <header>
    <div class="navbar fixed-top navbar-dark bg-primary shadow">
      <div class="container-lg flex-column flex-md-row">
        <a
          v-if="routeURL"
          href="/"
          class="text-white"
          style="text-decoration: none"
          >View Other States</a
        >
        <h1 class="navbar-brand mb-0 fw-bold">
          {{ title }}
        </h1>
        <div v-if="withReload">
          <button class="btn btn-light" onclick="window.location.reload();">
            <font-awesome-icon icon="redo-alt" /> Check for New Appointments
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: null,
    },
    withReload: {
      type: Boolean,
      default: false,
    },
  },

  head() {
    return {
      bodyAttrs: {
        class: this.withReload ? "has-navbar-with-reload" : "",
      },
    };
  },
  computed: {
    routeURL() {
      return this.$route.name !== "index";
    },
  },

  // Workaround for bodyAttrs not always seeming to work:
  // https://stackoverflow.com/a/55909431/222487
  mounted() {
    window.onNuxtReady(() => {
      if (this.withReload) {
        document.body.classList.add("has-navbar-with-reload");
      } else {
        document.body.classList.remove("has-navbar-with-reload");
      }
    });
  },
};
</script>

<style>
body {
  padding-top: 50px;
}

body.has-navbar-with-reload {
  padding-top: 88px;
}

.navbar a:hover {
  color: #b3d1fd !important;
}

h1.navbar-brand {
  font-size: 1rem;
}

@media (min-width: 768px) {
  body.has-navbar-with-reload {
    padding-top: 54px;
  }
}

@media (min-width: 360px) {
  h1.navbar-brand {
    font-size: 1.25rem;
  }
}
</style>
