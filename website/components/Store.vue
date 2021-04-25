<template>
  <div class="card mb-4 location-result">
    <a :id="`location-${store.properties.id}`" class="location-anchor" />
    <div class="card-header">
      <div class="row">
        <h5 class="col-sm mb-0">
          {{ title }}
        </h5>
        <div v-if="store.distance" class="col-sm-auto">
          {{ $t("{distance} miles", { distance: store.distance }) }}
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="store.properties.appointments_available === true">
        <div class="location-status text-success fs-2">
          <font-awesome-icon icon="check-circle" class="align-middle" />
          <span class="fs-5">
            {{ $t("Appointments available as of") }}
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
            <!-- eslint-disable vue/no-v-html -->
            <span
              v-html="
                $t(
                  '<strong>Warning:</strong> {name} appears to only be updating their data every 30-60 minutes, so this status may become outdated more quickly than other providers. But if they increase their frequency of updates, Vaccine Spotter will start showing updates sooner too.',
                  { name: store.properties.provider_brand_name }
                )
              "
            />
            <!-- eslint-enable vue/no-v-html -->
          </small>
        </p>

        <p v-if="store.properties.provider === 'kroger'" class="text-warning">
          <small
            ><font-awesome-icon icon="exclamation-triangle" />
            <!-- eslint-disable vue/no-v-html -->
            <span
              v-html="
                $t(
                  '<strong>Warning:</strong> Many users are reporting issues booking appointments with {name} (due to 2nd appointment requirements). However, some users have still reported success, so I still want to share the data I have from the pharmacies. I\'m trying to figure out a better way to detect these issues, but in the meantime, sorry for any frustration!',
                  { name: store.properties.provider_brand_name }
                )
              "
          /></small>
        </p>

        <a
          :href="store.properties.url"
          class="btn btn-primary"
          target="_blank"
          :rel="providerBrandUrlRel"
          >{{
            $t("Visit {name} Website", {
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

      <p class="card-text text-secondary mt-2">
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
