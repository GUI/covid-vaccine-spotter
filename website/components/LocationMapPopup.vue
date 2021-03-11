<template>
  <div>
    <h6>{{ store.properties.provider_brand_name }}</h6>
    <p>
      <template v-if="store.properties.address">
        {{ store.properties.address }}<br />
      </template>
      {{ store.properties.city }}, {{ store.properties.state }}
      <template v-if="store.properties.postal_code">
        {{ store.properties.postal_code }}
      </template>
    </p>
    <div>
      <div v-if="store.properties.appointments_available === true">
        <p class="text-success">
          <font-awesome-icon icon="check-circle" />
          Appointments available as of
          <display-local-time
            :time="appointmentsLastFetchedDate"
            :time-zone="store.properties.time_zone"
          />
        </p>
        <p>
          <a :href="`#location-${store.properties.id}`"
            >View Appointment Details</a
          >
        </p>
      </div>
      <div v-else>
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            No appointments available as of last check
          </p>
        </div>
        <div v-else>
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
              <a :href="store.properties.url" target="_blank" rel="noopener"
                >pharmacy's website</a
              >
              directly for appointment availability. This likely means that the
              pharmacy is blocking our tool from accessing their site.
            </p>
          </div>

          <p>
            <a :href="store.properties.url" target="_blank" rel="noopener"
              >Visit {{ store.properties.provider_brand_name }} Website
              <font-awesome-icon icon="external-link-alt"
            /></a>
          </p>
        </div>
      </div>

      <p class="mb-0">
        <small
          >Last checked
          <display-local-time
            v-if="store.properties.appointments_last_fetched"
            :time="appointmentsLastFetchedDate"
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
      return new Date(this.store.properties.appointments_last_fetched);
    },
  },
};
</script>
