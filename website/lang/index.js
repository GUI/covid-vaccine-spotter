import en from "./english";
import es from "./spanish";
export default {
  locales: ["en", "es"],
  defaultLocale: "en",
  vueI18n: {
    fallbackLocale: "en",
    messages: {
      en,
      es,
    },
  },
};
