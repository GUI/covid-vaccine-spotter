<template>
  <div>
    <h6>{{ title }}</h6>
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
          {{ appointments.available }}
          <display-local-time :time="appointmentsLastModifiedDate" :iso="iso" />
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
            <a :href="store.properties.url" target="_blank" rel="noopener"
                                                            :rel="providerBrandUrlRel">
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
            :iso="iso"
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
    iso: {
      type: String,
      required: true,
    },
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
    title() {
      let title = this.store.properties.provider_brand_name;
      if (
        this.store.properties.provider_brand === "centura_driveup_event" ||
        this.store.properties.provider_brand === "comassvax" ||
        this.store.properties.provider_brand === "costco" ||
        this.store.properties.provider_brand === "health_mart"
      ) {
        title += ` - ${this.store.properties.name}`;
      }

      return title;
    },

    providerBrandUrlRel() {
      let rel = "noopener";
      // Walgreens seems to be blocking links from certain referrers if you
      // haven't first visited walgreens.com and have cookies.
      if (this.store.properties.provider === "walgreens") {
        rel += " noreferrer";
      }

      return rel;
    },

    appointmentsLastFetchedDate() {
      return new Date(this.store.properties.appointments_last_fetched);
    },

    appointmentsLastModifiedDate() {
      return new Date(this.store.properties.appointments_last_modified);
    },
  },
};
</script>
