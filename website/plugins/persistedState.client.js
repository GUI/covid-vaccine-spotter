import createPersistedState from "vuex-persistedstate";

export default ({ store }) => {
  createPersistedState({
    paths: ["instructions.visible", "news.hiddenTime"],
  })(store);
};
