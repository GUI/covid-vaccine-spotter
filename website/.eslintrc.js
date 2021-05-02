module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  parserOptions: {
    parser: "babel-eslint",
  },
  extends: [
    "airbnb-base",
    "@nuxtjs",
    "prettier",
    "plugin:prettier/recommended",
    "plugin:nuxt/recommended",
  ],
  plugins: ["prettier"],
  // add your custom rules here
  rules: {},
  overrides: [
    {
      files: ["store/**/*.js"],
      rules: {
        "no-shadow": ["error", { allow: ["state", "getters"] }],
        "no-param-reassign": [
          "error",
          {
            props: true,
            ignorePropertyModificationsFor: ["state"],
          },
        ],
      },
    },
    {
      files: ["lang/generated/*.js"],
      rules: {
        eqeqeq: "off",
        "func-names": "off",
        "object-shorthand": "off",
      },
    },
  ],
};
