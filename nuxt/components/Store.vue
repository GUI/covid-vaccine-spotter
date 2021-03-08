<template>
  <div class="card mb-4 location-result">
    <div class="card-header" :id="`location-${store.properties.id}`">
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
        <p
          class="text-warning"
          v-if="
            store.properties.provider === 'kroger' ||
            store.properties.provider === 'walgreens'
          "
        >
          <small
            ><font-awesome-icon icon="exclamation-triangle" />
            <strong>Warning:</strong> Many users are reporting issues booking
            appointments with {{ store.properties.provider_brand_name }} (due to
            2nd appointment requirements). However, some users have still
            reported success, so I still want to share the data I have from the
            pharmacies. I'm trying to figure out a better way to detect these
            issues, but in the meantime, sorry for any frustration!</small
          >
        </p>
        <a :href="store.properties.url" class="btn btn-primary" target="_blank"
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
          <p v-if="store.properties.carries_vaccine === false">
            At last check, this location does not carry the vaccine at all, so
            we have not fetched any appointments.
          </p>
          <p v-else-if="store.properties.appointments_last_fetched === null">
            We haven't collected any data for this pharmacy yet.
          </p>
          <p v-else>
            <strong>Uh oh!</strong> The data for this pharmacy is old. Please
            visit the
            <a :href="store.properties.url" target="_blank"
              >pharmacy's website</a
            >
            directly for appointment availability. This likely means that the
            pharmacy is blocking our tool from accessing their site.
          </p>
        </div>
        <p>
          <a :href="store.properties.url" target="_blank"
            >Visit {{ store.properties.provider_brand_name }} Website
            <font-awesome-icon icon="external-link-alt"
          /></a>
        </p>
      </div>

      <p class="card-text text-secondary mt-2">
        <small
          >Last checked
          <display-local-time
            :time="appointmentsLastFetchedDate"
            v-if="store.properties.appointments_last_fetched"
          />
          <span v-if="!store.properties.appointments_last_fetched"
            >never</span
          ></small
        >
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

.text-warning {
  color: #d99011 !important;
}
</style>
