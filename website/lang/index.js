import en from "./generated/en.json";
import es from "./generated/es-US.json";
import pluralizationRules from "./generated/pluralizationRules";

export default {
  seo: false,
  locales: [
    { code: "en", iso: "en-US" },
    { code: "es", iso: "es-US" },
  ],
  defaultLocale: "en",
  vueI18n: {
    fallbackLocale: "en",
    formatFallbackMessages: true,
    silentTranslationWarn: true,
    messages: {
      en,
      es,
    },
    pluralizationRules,
  },
};
