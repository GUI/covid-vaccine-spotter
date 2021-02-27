module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["airbnb-base", "prettier"],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "no-console": "off",

    // TODO: Revisit these.
    "no-continue": "off",
    "no-await-in-loop": "off",
    "no-restricted-syntax": "off",
  },
  overrides: [
    {
      files: ["migrations/**/*.js"],
      rules: {
        "func-names": "off",
        "import/no-extraneous-dependencies": "off",
      },
    },
    {
      files: ["src/tasks/**/*.js"],
      rules: {
        "import/no-extraneous-dependencies": "off",
      },
    },
  ],
};
