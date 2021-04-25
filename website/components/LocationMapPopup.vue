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
          {{ $t("Appointments available as of") }}
          <display-local-time
            :time="appointmentsLastModifiedDate"
            :iso="$i18n.localeProperties.iso"
          />
        </p>
        <p>
          <a :href="`#location-${store.properties.id}`">{{
            $t("View Appointment Details")
          }}</a>
        </p>
      </div>
      <div v-else>
        <div v-if="store.properties.appointments_available === false">
          <p class="text-danger">
            <font-awesome-icon icon="times-circle" />
            {{ $t("No appointments available as of last check") }}
          </p>
        </div>
        <div v-else>
          <div v-if="store.properties.appointments_available === false">
            <p class="text-danger">
              <font-awesome-icon icon="times-circle" />
              {{ $t("No appointments available as of last check") }}
            </p>
          </div>
          <div v-else>
            <p>
              <font-awesome-icon icon="times-circle" />
              {{ $t("Unknown status") }}
            </p>
            <p v-if="store.properties.carries_vaccine === false">
              {{
                $t(
                  "At last check, this location does not carry the vaccine at all, so we have not fetched any appointments."
                )
              }}
            </p>
            <p v-else-if="store.properties.appointments_last_fetched === null">
              {{ $t("We haven't collected any data for this pharmacy yet.") }}
            </p>
            <!-- eslint-disable vue/no-v-html -->
            <p
              v-else
              v-html="
                $t(
                  '<strong>Uh oh!</strong> The data for this pharmacy is old. Please visit the <a href=\u0022{link}\u0022 target=\u0022_blank\u0022 rel=\u0022noopener\u0022>pharmacy\'s website</a> directly for appointment availability. this likely means that the pharmacy is blocking our tool from accessing their website.',
                  { link: store.properties.url }
                )
              "
            />
            <!-- eslint-enable vue/no-v-html -->
          </div>

          <p>
            <a
              :href="store.properties.url"
              target="_blank"
              :rel="providerBrandUrlRel"
              >{{
                $t("Visit {name} Website", {
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
          >{{ $t("Last checked") }}
          <display-local-time
            v-if="store.properties.appointments_last_fetched"
            :time="appointmentsLastFetchedDate"
            :iso="$i18n.localeProperties.iso"
          />
          <span v-if="!store.properties.appointments_last_fetched">{{
            $t("never")
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
