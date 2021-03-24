<template>
  <div class="card mb-4 location-result">
    <a :id="`location-${store.properties.id}`" class="location-anchor" />
    <div class="card-header">
      <div class="row">
        <h5 class="col-sm mb-0">
          {{ store.properties.provider_brand_name }} -
          {{ store.properties.address }}, {{ store.properties.city }},
          {{ store.properties.state }}
          {{ store.properties.postal_code }}
        </h5>
        {{ /* Use v-show, not v-if for conditions without "else". Otherwise, strange things happen in production that cause rendering to fail (if the page is reloaded with a zip code pre-filled): https://github.com/nuxt/nuxt.js/issues/5800 */ }}
        <div v-show="store.distance" class="col-sm-auto">
          {{ store.distance }} {{ $t("store.miles") }}
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="store.properties.appointments_available === true">
        <div class="location-status text-success fs-2">
          <font-awesome-icon icon="check-circle" class="align-middle" />
          <span class="fs-5"
            >{{ $t("store.appointmentsAvailable") }}
            <display-local-time
              :time="appointmentsLastFetchedDate"
              :time-zone="store.properties.time_zone"
          /></span>
        </div>
        <appointment-times :store="store" />
        {{ /* Use v-show, not v-if for conditions without "else". Otherwise, strange things happen in production that cause rendering to fail (if the page is reloaded with a zip code pre-filled): https://github.com/nuxt/nuxt.js/issues/5800 */ }}
        <p v-show="store.properties.provider === 'kroger'" class="text-warning">
          <small
            ><font-awesome-icon icon="exclamation-triangle" />
            {{ $t("store.krogerWarning") }}</small
          >
        </p>

        <p v-show="riteAidEducationOnly" class="text-warning">
          <font-awesome-icon icon="exclamation-triangle" />
          <strong
            >Education Staff and Childcare Providers Only<span
              v-show="store.properties.state === 'PA'"
            >
              in Philadelphia</span
            >:</strong
          >
          Rite Aid appointments are
          <a
            href="https://www.riteaid.com/corporate/news/-/pressreleases/news-room/2021/rite-aid-extends-covid-19-vaccine-priority-scheduling-period-for-teachers-school-staff-and-childcare-providers"
            target="_blank"
            rel="noopener"
            >only bookable by teachers, school staff and childcare providers</a
          >
          on Friday, March 19, Saturday, March 20, Friday, March 26, and
          Saturday, March 27<span v-show="store.properties.state === 'PA'">
            in Philadelphia (outside of Philadelphia other groups may still be
            eligible)</span
          >. Rite Aid appointments should re-open to other eligible groups again
          on other days.
        </p>

        <a
          :href="store.properties.url"
          class="btn btn-primary"
          target="_blank"
          rel="noopener"
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
            {{ $t("appointments.noneAvailable") }}
          </p>
          <p v-if="store.properties.carries_vaccine === false">
            {{ $t("appointments.doesNotCarry") }}
          </p>
          <p v-else-if="store.properties.appointments_last_fetched === null">
            {{ $t("appointments.notCollected") }}
          </p>
          <p
            v-else
            v-html="$t('appointments.oldData', { link: store.properties.url })"
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

      <p class="card-text text-secondary mt-2">
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
}
</style>
