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
              :time="appointmentsLastFetchedDate"
              :iso="$i18n.localeProperties.iso"
          /></span>
        </div>
        <appointment-times :store="store" />
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

        <p v-if="riteAidEducationOnly" class="text-warning">
          <font-awesome-icon icon="exclamation-triangle" />
          <strong
            >{{ $t("store.educationStaff")
            }}<span v-show="store.properties.state === 'PA'">
              {{ $t("store.inPhiladelphia") }}</span
            >:</strong
          >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-html="$t('store.riteAid')" />
        </p>

        <a
          :href="store.properties.url"
          class="btn btn-primary"
          target="_blank"
          rel="noopener"
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
import { DateTime } from "luxon";

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

    title() {
      let title = this.store.properties.provider_brand_name;
      if (this.store.properties.provider_brand === "centura_driveup_event") {
        title += ` - ${this.store.properties.name}`;
      }
      title += ` - ${this.fullAddress}`;

      return title;
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

    riteAidEducationOnly() {
      const { provider, state } = this.store.properties;
      const today = DateTime.now()
        .setZone(this.store.properties.time_zone)
        .toISODate();
      return (
        provider === "rite_aid" &&
        (today === "2021-03-19" ||
          today === "2021-03-20" ||
          today === "2021-03-26" ||
          today === "2021-03-27") &&
        (state === "CA" ||
          state === "MI" ||
          state === "PA" ||
          state === "NJ" ||
          state === "OH" ||
          state === "OR" ||
          state === "VA" ||
          state === "WA")
      );
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

.location-anchor {
  padding-top: 56px;
  margin-top: -56px;
  z-index: -9999;
}
</style>
