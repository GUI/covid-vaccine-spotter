<template>
  <div class="card mb-4 location-result">
    <div class="card-header">
      <div class="row">
        <h5 class="col-sm mb-0">
          {{ store.properties.provider_brand_name }} -
          {{ store.properties.address }}, {{ store.properties.city }},
          {{ store.properties.state }}
          {{ store.properties.postal_code }}
        </h5>
        <div class="col-sm-auto" v-if="store.distance">
          {{ store.distance }} miles
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="store.properties.appointments_available === true">
        <div class="location-status text-success fs-2">
          <font-awesome-icon icon="check-circle" class="align-middle" />
          <span class="fs-5"
            >Appointments available as of
            <display-local-time
              :time="appointmentsLastFetchedDate"
              :time-zone="store.properties.time_zone"
          /></span>
        </div>
        <p class="text-warning">
          <small
            ><font-awesome-icon icon="exclamation-triangle" /> 03/01/2021: I've
            received reports from various users that despite Walgreens showing
            availability, you may not be able to book a second dose appointment
            at this time. Sorry for the frustration! I think this may be an
            issue on Walgreen's side, so not sure there's much I can do to
            detect this, but I'm investigating more. In the meantime, it may
            still be worth trying to book an appointment in hopes that Walgreens
            has fixed things.</small
          >
        </p>
        <a
          :href="store.properties.provider_brand_url"
          class="btn btn-primary"
          target="_blank"
          >Visit {{ store.properties.provider_brand_name }} Website
          <font-awesome-icon icon="arrow-alt-circle-right"
        /></a>
      </div>
      <div v-else class="location-status">
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            No appointments available as of last check
          </p>
        </div>
        <div v-else>
          <p>
            <font-awesome-icon icon="times-circle" />
            Unknown status
          </p>
        </div>

        <p>
          <a
            href="https://www.walgreens.com/findcare/vaccination/covid-19/location-screening"
            target="_blank"
            >Walgreens Website<font-awesome-icon icon="external-link-alt"
          /></a>
        </p>
      </div>

      <p class="card-text text-secondary mt-2">
        <small
          >Last checked
          <display-local-time
            :time="appointmentsLastFetchedDate"
            :time-zone="store.properties.time_zone"
        /></small>
      </p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    store: {
      type: Object,
      required: true,
    },
  },

  computed: {
    appointmentsLastFetchedDate() {
      return new Date(this.store.properties.appointments_last_fetched)
    },
  },
}
</script>

<style>
.location-result .location-status {
  line-height: 1rem;
  margin-bottom: 1rem;
}
</style>
