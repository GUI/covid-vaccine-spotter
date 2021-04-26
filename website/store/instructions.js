export const state = () => ({
  visible: true,
});

export const mutations = {
  setVisible(state, visible) {
    state.visible = visible;
  },
};
