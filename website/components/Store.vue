<template>
  <div class="card mb-4 location-result">
    <a :id="`location-${store.properties.id}`" class="location-anchor" />
    <div class="card-header">
      <div class="row">
        <h5 class="col-sm mb-0">
          {{ title }}
        </h5>
        <div v-if="store.distance" class="col-sm-auto">
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
            <display-local-time :time="appointmentsLastFetchedDate"
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
            <strong>Warning:</strong> Many users are reporting issues booking
            appointments with {{ store.properties.provider_brand_name }} (due to
            2nd appointment requirements). However, some users have still
            reported success, so I still want to share the data I have from the
            pharmacies. I'm trying to figure out a better way to detect these
            issues, but in the meantime, sorry for any frustration!</small
          >
        </p>

        <p v-if="riteAidEducationOnly" class="text-warning">
          <font-awesome-icon icon="exclamation-triangle" />
          <strong
            >Education Staff and Childcare Providers Only<span
              v-if="store.properties.state === 'PA'"
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
          Saturday, March 27<span v-if="store.properties.state === 'PA'">
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

      <p class="card-text text-secondary mt-2">
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
