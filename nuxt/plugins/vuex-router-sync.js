import { sync } from 'vuex-router-sync'

export default ({ app: { store, router } }) => {
  sync(store, router)
}
