import lang from "./website/lang";

const buildModules = ["@nuxtjs/google-analytics", "@nuxtjs/svg"];
if (process.env.NODE_ENV !== "production") {
  // https://go.nuxtjs.dev/eslint
  buildModules.push("@nuxtjs/eslint-module");
}

export default {
  srcDir: "website/",

  // Target: https://go.nuxtjs.dev/config-target
  target: "static",

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: "covid-vaccine-spotter",
    htmlAttrs: {
      lang: "en",
    },
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    link: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      {
        rel: "stylesheet",
        href:
          "https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta3/dist/css/bootstrap.min.css",
        integrity:
          "sha384-eOJMYsd53ii+scO/bJGFsiCZc+5NDVN2yr8+0RDqr0Ql0h+rP48ckxlpbzKgwra6",
        crossorigin: "anonymous",
      },
    ],
    script: [],
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: ["@fortawesome/fontawesome-svg-core/styles.css"],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    "~/plugins/vuex-router-sync",
    "~/plugins/fontawesome",
    "~/plugins/http",
    { src: "~/plugins/bootstrap", mode: "client" },
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules,

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    "nuxt-i18n",
    "@nuxt/http",
    [
      "nuxt-rollbar-module",
      {
        serverAccessToken: process.env.ROLLBAR_ACCESS_TOKEN,
        clientAccessToken: process.env.ROLLBAR_CLIENT_ACCESS_TOKEN,
        config: {
          addErrorContext: true,
          autoInstrument: true,
          captureUncaught: true,
          captureUnhandledRejections: true,
        },
      },
    ],
  ],

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},

  generate: {
    cache: {
      ignore: [
        "Dockerfile*",
        "LICENSE.txt",
        "bin/**/*",
        "copilot/**/*",
        "knexfile.js",
        "migrations/**/*",
        "serverless.yml",
        "src/**/*",
        "tmp/**/*",
        "website/static/**/*",
      ],
    },
  },

  vue: {
    config: {
      ignoredElements: ["local-time"],
    },
  },

  router: {
    trailingSlash: true,
    prefetchLinks: false,
    prefetchPayloads: false,
  },

  googleAnalytics: {
    id: "UA-49484378-1",
  },

  i18n: {
    ...lang,
  },

  http: {
    // Try to prevent some random browsers from apparently requesting
    // localhost:3000 requests in production for API calls.
    browserBaseURL: "/",
  },
};
