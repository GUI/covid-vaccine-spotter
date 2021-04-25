<template>
  <div class="card mb-4 location-result">
    <a :id="`location-${store.properties.id}`" class="location-anchor" />
    <div class="card-header">
      <div class="row">
        <h5 class="col-sm mb-0">
          {{ title }}
        </h5>
        <div v-if="store.distance" class="col-sm-auto">
          {{ store.distance }} {{ $t("store.miles") }}
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="store.properties.appointments_available === true">
        <div class="location-status text-success fs-2">
          <font-awesome-icon icon="check-circle" class="align-middle" />
          <span class="fs-5">
            {{ $t("store.appointmentsAvailable") }}
            <display-local-time
              :time="appointmentsLastModifiedDate"
              :iso="$i18n.localeProperties.iso"
          /></span>
        </div>
        <appointment-times :store="store" />
        <p
          v-if="store.properties.provider === 'albertsons'"
          class="text-warning"
        >
          <small
            ><font-awesome-icon icon="exclamation-triangle" />
            <strong>Warning:</strong>
            {{ store.properties.provider_brand_name }} appears to only be
            updating their data every 30-60 minutes, so this status may become
            outdated more quickly than other providers. But if they increase
            their frequency of updates, Vaccine Spotter will start showing
            updates sooner too.</small
          >
        </p>

        <p v-if="store.properties.provider === 'kroger'" class="text-warning">
          <small
            ><font-awesome-icon icon="exclamation-triangle" />
            {{
              $t("store.krogerWarning", {
                name: store.properties.provider_brand_name,
              })
            }}</small
          >
        </p>

        <a
          :href="store.properties.url"
          class="btn btn-primary"
          target="_blank"
          :rel="providerBrandUrlRel"
          >{{
            $t("buttons.visitWebsite", {
              name: store.properties.provider_brand_name,
            })
          }}
          <font-awesome-icon icon="arrow-alt-circle-right"
        /></a>
      </div>
      <div v-else class="location-status">
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            {{ $t("appointments.noneAvailable") }}
          </p>
        </div>
        <div v-else>
          <p>
            <font-awesome-icon icon="times-circle" />
            {{ $t("appointments.noneAvailable") }}
          </p>
          <p v-if="store.properties.carries_vaccine === false">
            {{ $t("appointments.doesNotCarry") }}
          </p>
          <p v-else-if="store.properties.appointments_last_fetched === null">
            {{ $t("appointments.notCollected") }}
          </p>
          <!-- eslint-disable vue/no-v-html -->
          <p
            v-else
            v-html="$t('appointments.oldData', { link: store.properties.url })"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>
        <p>
          <a :href="store.properties.url" target="_blank" rel="noopener"
            :rel="providerBrandUrlRel"
            >{{
              $t("appointments.visitWebsite", {
                name: store.properties.provider_brand_name,
              })
            }}
            <font-awesome-icon icon="external-link-alt"
          /></a>
        </p>
      </div>

      <p class="card-text text-secondary mt-2">
        <small
          >{{ $t("appointments.lastChecked") }}
          <display-local-time
            v-if="store.properties.appointments_last_fetched"
            :time="appointmentsLastFetchedDate"
            :iso="$i18n.localeProperties.iso"
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

  data() {
    return {
      loaded: false,
    };
  },

  computed: {
    appointmentsLastFetchedDate() {
      return new Date(this.store.properties.appointments_last_fetched);
    },

    appointmentsLastModifiedDate() {
      return new Date(this.store.properties.appointments_last_modified);
    },

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
      title += ` - ${this.fullAddress}`;

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

    fullAddress() {
      return [
        this.store.properties.address,
        this.store.properties.city,
        [this.store.properties.state, this.store.properties.postal_code]
          .filter((value) => !!value)
          .join(", "),
      ]
        .filter((value) => !!value)
        .join(", ");
    },
  },

  created() {
    // "loaded" workaround due to odd issues in built production mode (if zip
    // code is set and the page is reloaded then things fail to render):
    // https://github.com/nuxt/nuxt.js/issues/5800#issuecomment-613739824
    this.$nextTick(() => {
      this.loaded = true;
    });
  },
};
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
