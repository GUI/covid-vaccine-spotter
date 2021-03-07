export const state = () => ({
  locations: [],
})

export const mutations = {
  setLocations(state, locations) {
    state.locations = locations
  },
}
