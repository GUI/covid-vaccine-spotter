<template>
  <tr
    :class="[
      {
        'table-success': providerBrand.status === 'active',
        'table-danger': providerBrand.status === 'inactive',
        'table-light': providerBrand.status === 'unknown',
      },
    ]"
  >
    <td class="text-nowrap fw-bold">
      <a :href="providerBrand.url" target="_blank" :rel="providerBrandUrlRel">{{
        providerBrand.name
      }}</a>
    </td>
    <td class="text-nowrap">
      {{
        $t("status.scanningCount", {
          count: providerBrand.location_count,
        })
      }}
    </td>
    <td>
      <div class="fw-bold">
        <font-awesome-icon
          v-if="providerBrand.status === 'active'"
          icon="check-circle"
          class="text-success"
        />
        <font-awesome-icon
          v-if="providerBrand.status === 'inactive'"
          icon="times-circle"
          class="text-danger"
        />

        <display-local-time
          v-if="providerBrand.appointments_last_fetched"
          :time="new Date(providerBrand.appointments_last_fetched)"
        />
        <span v-if="!providerBrand.appointments_last_fetched">$t("appointments.never")</span>
      </div>

      <div v-if="providerBrand.status === 'inactive'">
        <!-- eslint-disable vue/no-v-html -->
        <span
          v-html="
            $t('appointments.oldData', { link: providerBrand.url })
          "
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <div v-if="providerBrand.status === 'unknown'">
        {{ $t("appointments.notCollected") }}
      </div>
    </td>
  </tr>
</template>

<script>
export default {
  props: {
    providerBrand: {
      type: Object,
      required: true,
    },
  },

  computed: {
    providerBrandUrlRel() {
      let rel = "noopener";
      // Walgreens seems to be blocking links from certain referrers if you
      // haven't first visited walgreens.com and have cookies.
      if (this.providerBrand.provider_id === "walgreens") {
        rel += " noreferrer";
      }

      return rel;
    },
  },
};
</script>

<style></style>
