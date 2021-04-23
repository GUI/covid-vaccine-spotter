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
    <td class="text-nowrap">{{ providerBrand.location_count }} locations</td>
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
        <span v-if="!providerBrand.appointments_last_fetched">Never</span>
      </div>

      <div v-if="providerBrand.status === 'inactive'">
        <strong>Uh oh!</strong> The data for this pharmacy is old. Please visit
        the
        <a :href="providerBrand.url" target="_blank" :rel="providerBrandUrlRel"
          >pharmacy's website</a
        >
        directly for appointment availability.<br /><br />This likely means that
        the pharmacy is blocking our tool from accessing their site. We'll try
        to restore access if it's something we can fix, but that may not always
        be possible. Sorry!
      </div>

      <div v-if="providerBrand.status === 'unknown'">
        <strong>Hmm.</strong> We haven't collected any data for this pharmacy
        yet.<br /><br />This might mean we're working on it, or this is some
        weird data you can probably ignore.
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
