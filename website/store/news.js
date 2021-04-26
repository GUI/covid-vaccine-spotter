export const state = () => ({
  hiddenTime: null,
});

export const mutations = {
  setHiddenTime(state, hiddenTime) {
    state.hiddenTime = hiddenTime;
  },
};
