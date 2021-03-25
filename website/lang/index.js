import en from "./english";
import es from "./spanish";
export default {
  seo: false,
  locales: [
    { code: "en", iso: "en-US" },
    { code: "es", iso: "es-EN" },
  ],
  defaultLocale: "en",
  vueI18n: {
    fallbackLocale: "en",
    messages: {
      en,
      es,
    },
  },
};
