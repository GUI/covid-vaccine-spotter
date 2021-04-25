import en from "./en.json";
import es from "./es.json";

export default {
  seo: false,
  locales: [
    { code: "en", iso: "en-US" },
    { code: "es", iso: "es-EN" },
  ],
  defaultLocale: "en",
  vueI18n: {
    fallbackLocale: "en",
    formatFallbackMessages: true,
    silentTranslationWarn: true,
    // silentFallbackWarn: true,
    messages: {
      en,
      es,
    },
  },
};
