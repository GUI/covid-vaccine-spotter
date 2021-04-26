<template>
  <div>
    <div v-if="store.properties.appointments_available === true">
      <div class="location-status text-success d-flex align-items-center">
        <font-awesome-icon icon="check-circle" class="me-2" />
        <span>
          <span class="d-inline-block">{{
            $t("Appointments available as of")
          }}</span>
          <span class="d-inline-block">
            <display-local-time
              :time="appointmentsLastModifiedDate"
              :iso="$i18n.localeProperties.iso"
          /></span>
        </span>
      </div>
      <appointment-times :store="store" />
      <p v-if="store.properties.provider === 'albertsons'" class="text-warning">
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

    appointmentsLastModifiedDate() {
      return new Date(this.store.properties.appointments_last_modified);
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
  },
};
</script>

<style>
.location-status {
  line-height: 120%;
  margin-bottom: 0.6rem;
}

.text-warning {
  color: #d99011 !important;
}

.location-status.text-success {
  font-size: 1.25rem;
}

.location-status.text-success svg {
  font-size: 2rem;
}
</style>
