<template>
  <div>
    <h3>{{ $t("status.title") }}</h3>
    <div class="table-responsive">
      <table class="table table-bordered">
        <thead>
          <tr class="table-primary-dark">
            <th v-for="column in $t('status.columnHeaders')" :key="column">
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="providerBrand in $store.state.usStates.usState.metadata
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
              <a :href="providerBrand.url" target="_blank" rel="noopener">{{
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
                <span v-if="!providerBrand.appointments_last_fetched">{{
                  $t("appointments.never")
                }}</span>
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
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {};
</script>

<style>
.table-primary-dark th {
  color: #fff;
  background-color: #0d6efd;
}
</style>
