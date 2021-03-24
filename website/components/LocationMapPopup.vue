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
          {{ $t("appointmentStatus.available") + " " }}
          <display-local-time
            :time="appointmentsLastFetchedDate"
            :time-zone="store.properties.time_zone"
          />
        </p>
        <p>
          <a :href="`#location-${store.properties.id}`">{{
            $t("appointments.viewDetails")
          }}</a>
        </p>
      </div>
      <div v-else>
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            {{ $t("appointments.noneAvailable") }}
          </p>
        </div>
        <div v-else>
          <div v-if="store.properties.appointments_available === false">
            <p class="text-danger">
              <font-awesome-icon icon="times-circle" />
              {{ $t("appointments.noneAvailable") }}
            </p>
          </div>
          <div v-else>
            <p>
              <font-awesome-icon icon="times-circle" />
              {{ $t("appointments.unknown") }}
            </p>
            <p v-if="store.properties.carries_vaccine === false">
              {{ $t("appointments.doesNotCarry") }}
            </p>
            <p v-else-if="store.properties.appointments_last_fetched === null">
              {{ $t("appointments.notCollected") }}
            </p>
            <p
              v-else
              v-html="
                $t('appointments.oldData', { link: store.properties.url })
              "
            ></p>
          </div>

          <p>
            <a :href="store.properties.url" target="_blank" rel="noopener"
              >{{
                $t("appointments.visitWebsite", {
                  name: store.properties.provider_brand_name,
                })
              }}
              <font-awesome-icon icon="external-link-alt"
            /></a>
          </p>
        </div>
      </div>

      <p class="mb-0">
        <small
          >{{ $t("appointments.lastChecked") }}
          <display-local-time
            v-if="store.properties.appointments_last_fetched"
            :time="appointmentsLastFetchedDate"
          />
          <span v-if="!store.properties.appointments_last_fetched">{{
            $t("appointments.never")
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
  },

  computed: {
    appointmentsLastFetchedDate() {
      return new Date(this.store.properties.appointments_last_fetched);
    },
  },
};
</script>
