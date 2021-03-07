<template>
  <div>
    <h6>{{ store.properties.provider_brand_name }}</h6>
    <p>
      {{ store.properties.address }}<br />
      {{ store.properties.city }}, {{ store.properties.state }}
      {{ store.properties.postal_code }}
    </p>
    <div>
      <div v-if="store.properties.appointments_available === true">
        <div class="text-success">
          <font-awesome-icon icon="check-circle" />
          Appointments available as of
          <display-local-time
            :time="appointmentsLastFetchedDate"
            :time-zone="store.properties.time_zone"
          />
        </div>
      </div>
      <div v-else-if="store.properties.appointments_available === false">
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

      <small
        >Last checked
        <display-local-time
          :time="appointmentsLastFetchedDate"
          :time-zone="store.properties.time_zone"
      /></small>
    </div>
    <p class="mb-0"><a href="">View Appointment Details</a></p>
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
