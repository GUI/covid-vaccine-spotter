export const state = () => ({
  postalCodes: [],
});

export const mutations = {
  set(state, postalCodes) {
    state.postalCodes = Object.freeze(postalCodes);
  },
};
