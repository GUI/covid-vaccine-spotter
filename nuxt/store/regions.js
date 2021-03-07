import KDBush from 'kdbush'
import geokdbush from 'geokdbush'

const KM_TO_MILE = 0.621371
const MILE_TO_KM = 1.60934

console.info('kdbush: ', require('kdbush'))
console.info('kdbush.KDBush: ', require('kdbush').KDBush)
console.info('KDBush: ', KDBush)
export const state = () => ({
  region: {},
  filterError: null,
})

export const getters = {
  getFilteredLocations(state, getters, rootState) {
    state.filterError = null
    let locations = state.region.features

    const queryIncludeAll = rootState.route.query.include_all
    if (queryIncludeAll !== 'true') {
      locations = locations.filter(
        (location) => location.properties.appointments_available
      )
    }

    const queryZip = rootState.route.query.zip
    if (queryZip) {
      const queryZipCoords = rootState.postalCodes.postalCodes[queryZip]
      if (!queryZipCoords) {
        locations = []
        state.filterError =
          "Oops! We couldn't find that ZIP code in this state. Please double check it or try a different ZIP code."
      } else {
        let radius
        const queryRadius = rootState.route.query.radius
        if (queryRadius) {
          radius = parseInt(queryRadius, 10) * MILE_TO_KM
        }
        console.info('radius: ', radius)

        const locationsIndex = new KDBush(
          locations,
          (l) => l.geometry.coordinates[0],
          (l) => l.geometry.coordinates[1]
        )
        locations = geokdbush.around(
          locationsIndex,
          queryZipCoords[0],
          queryZipCoords[1],
          undefined,
          radius
        )
        console.info(locations)

        locations = locations.map((feature) => {
          let distance =
            geokdbush.distance(
              queryZipCoords[0],
              queryZipCoords[1],
              feature.geometry.coordinates[0],
              feature.geometry.coordinates[1]
            ) * KM_TO_MILE

          if (distance < 10) {
            distance = distance.toFixed(1)
          } else {
            distance = distance.toFixed(0)
          }

          return {
            ...feature,
            distance,
          }
        })

        locations.sort((a, b) => a.distance - b.distance)
      }
    }

    return locations
  },
}

export const mutations = {
  set(state, region) {
    state.region = region
  },
}
