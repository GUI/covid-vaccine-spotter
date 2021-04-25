import en from "./en";
import es from "./es";

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
