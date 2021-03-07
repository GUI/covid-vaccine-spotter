import KDBush from 'kdbush'
import geokdbush from 'geokdbush'
import circle from '@turf/circle'
import bbox from '@turf/bbox'

const KM_TO_MILE = 0.621371
const MILE_TO_KM = 1.60934

export const state = () => ({
  region: {},
  filterError: null,
})

export const getters = {
  getMapZipCoords(state, getters, rootState) {
    let zipCoords

    const queryZip = rootState.route.query.zip
    if (queryZip) {
      zipCoords = rootState.postalCodes.postalCodes[queryZip]
    }

    return zipCoords
  },

  getMapBounds(state, getters, rootState) {
    let bounds

    const queryZip = rootState.route.query.zip
    if (queryZip) {
      const queryZipCoords = rootState.postalCodes.postalCodes[queryZip]
      if (queryZipCoords) {
        const queryRadius = rootState.route.query.radius
        if (queryRadius) {
          bounds = bbox(
            circle(queryZipCoords, parseInt(queryRadius, 10), {
              units: 'miles',
            })
          )
        }
      }
    }

    if (!bounds) {
      bounds = bbox(state.region.metadata.bounding_box)
      /*
      const bboxPolygon = this.$store.state.regions.region.metadata.bounding_box
        .coordinates[0]
      bounds = [
        [bboxPolygon[0][0], bboxPolygon[0][1]],
        [bboxPolygon[2][0], bboxPolygon[2][1]],
      ]
      */
    }

    return bounds
  },

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
