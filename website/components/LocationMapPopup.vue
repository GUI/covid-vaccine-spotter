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
        <p class="text-success">
          <font-awesome-icon icon="check-circle" />
          {{ appointments.available }}
          <display-local-time
            :time="appointmentsLastFetchedDate"
            :time-zone="store.properties.time_zone"
          />
        </p>
        <p>
          <a :href="`#location-${store.properties.id}`">{{
            appointments.viewDetails
          }}</a>
        </p>
      </div>
      <div v-else>
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            {{ appointments.noneAvailable }}
          </p>
        </div>
        <div v-else>
          <div v-if="store.properties.appointments_available === false">
            <p class="text-danger">
              <font-awesome-icon icon="times-circle" />
              {{ appointments.noneAvailable }}
            </p>
          </div>
          <div v-else>
            <p>
              <font-awesome-icon icon="times-circle" />
              {{ appointments.unknown }}
            </p>
            <p v-if="store.properties.carries_vaccine === false">
              {{ appointments.doesNotCarry }}
            </p>
            <p v-else-if="store.properties.appointments_last_fetched === null">
              {{ appointments.notCollected }}
            </p>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p v-else v-html="appointments.oldData" />
          </div>

          <p>
            <a :href="store.properties.url" target="_blank" rel="noopener">
              {{ appointments.visitWebsite }}
              <font-awesome-icon icon="external-link-alt"
            /></a>
          </p>
        </div>
      </div>

      <p class="mb-0">
        <small
          >{{ appointments.lastChecked }}
          <display-local-time
            v-if="store.properties.appointments_last_fetched"
            :time="appointmentsLastFetchedDate"
          />
          <span v-if="!store.properties.appointments_last_fetched">{{
            appointments.never
          }}</span></small
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
    appointments: {
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
