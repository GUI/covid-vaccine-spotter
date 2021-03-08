<template>
  <div>
    <h3>Tool Status</h3>
    <table class="table table-bordered">
      <thead>
        <tr class="table-primary-dark">
          <th>Pharmacy</th>
          <th>Scanning</th>
          <th>Last Checked</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="providerBrand in $store.state.regions.region.metadata
            .provider_brands"
          :key="providerBrand.id"
          :class="[
            {
              'table-success': providerBrand.status === 'active',
              'table-danger': providerBrand.status === 'inactive',
              'table-light': providerBrand.status === 'unknown',
            },
          ]"
        >
          <td class="text-nowrap fw-bold">
            <a :href="providerBrand.url" target="_blank">{{
              providerBrand.name
            }}</a>
          </td>
          <td class="text-nowrap">
            {{ providerBrand.location_count }} locations
          </td>
          <td>
            <div class="fw-bold">
              <font-awesome-icon
                icon="check-circle"
                class="text-success"
                v-if="providerBrand.status === 'active'"
              />
              <font-awesome-icon
                icon="times-circle"
                class="text-danger"
                v-if="providerBrand.status === 'inactive'"
              />

              <display-local-time
                :time="new Date(providerBrand.appointments_last_fetched)"
                v-if="providerBrand.appointments_last_fetched"
              />
              <span v-if="!providerBrand.appointments_last_fetched">Never</span>
            </div>

            <div v-if="providerBrand.status === 'inactive'">
              <strong>Uh oh!</strong> The data for this pharmacy is old. Please
              visit the
              <a :href="providerBrand.url" target="_blank"
                >pharmacy's website</a
              >
              directly for appointment availability.<br /><br />This likely
              means that the pharmacy is blocking our tool from accessing their
              site. We'll try to restore access if it's something we can fix,
              but that may not always be possible. Sorry!
            </div>

            <div v-if="providerBrand.status === 'unknown'">
              <strong>Hmm.</strong> We haven't collected any data for this
              pharmacy yet.<br /><br />This might mean we're working on it, or
              this is some weird data you can probably ignore.
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {}
</script>

<style>
.table-primary-dark th {
  color: #fff;
  background-color: #0d6efd;
}
</style>
