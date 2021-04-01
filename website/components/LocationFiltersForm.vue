<template>
  <form class="row g-2 location-filters" @submit.prevent="submitForm">
    <div class="col-sm">
      <div class="row g-2">
        <div class="col-sm">
          <label for="zip" class="form-label"
            >Search for appointments near</label
          >
          <input
            id="zip"
            v-model="queryZip"
            type="text"
            name="zip"
            class="form-control form-control-lg"
            placeholder="Enter a 5 digit ZIP code"
            @change="submitForm"
          />
        </div>
        <div class="col-sm-auto">
          <label for="radius" class="form-label">Within</label>
          <select
            id="radius"
            v-model="queryRadius"
            name="radius"
            class="form-select form-select-lg mb-3"
            @change="submitForm"
          >
            <option value="">Any distance</option>
            <option value="5">5 miles</option>
            <option value="10">10 miles</option>
            <option value="25">25 miles</option>
            <option value="50">50 miles</option>
            <option value="100">100 miles</option>
          </select>
        </div>
      </div>
      <div class="row align-items-center">
        <div class="col-sm">
          <label for="appointment_type" class="form-label form-label-sm"
            >Appointment type</label
          >
          <select
            id="appointment_type"
            v-model="queryAppointmentType"
            name="appointment_type"
            class="form-select form-select-sm mb-3"
            @change="submitForm"
          >
            <option value="">All doses</option>
            <option value="2nd_dose_only">Second dose only</option>
          </select>
        </div>
        <div class="col-sm">
          <label for="vaccine_type" class="form-label form-label-sm"
            >Vaccine type</label
          >
          <select
            id="vaccine_type"
            v-model="queryVaccineType"
            name="vaccine_type"
            class="form-select form-select-sm mb-3"
            @change="submitForm"
          >
            <option value="">All</option>
            <option value="jj">Johnson &amp; Johnson</option>
            <option value="moderna">Moderna</option>
            <option value="pfizer">Pfizer</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div class="col-sm">
          <label for="provider" class="form-label form-label-sm"
            >Pharmacy</label
          >
          <select
            id="provider"
            v-model="queryProvider"
            name="provider"
            class="form-select form-select-sm mb-3"
            @change="submitForm"
          >
            <option value="">All</option>
            <option
              v-for="providerBrand in $store.state.usStates.usState.metadata
                .provider_brands"
              :key="providerBrand.id"
              :value="providerBrand.id"
            >
              {{ providerBrand.name }}
            </option>
          </select>
        </div>
        <div class="col-xl-auto">
          <div class="form-check">
            <input
              id="include_all"
              v-model="queryIncludeAll"
              name="include_all"
              value="true"
              class="form-check-input"
              type="checkbox"
              @change="submitForm"
            />
            <label class="form-check-label" for="include_all">
              Show locations without current appointments
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="col-auto">
      <button type="submit" class="btn btn-primary btn-lg">Search</button>
    </div>
  </form>
</template>

<script>
export default {
  data() {
    return {
      pendingQueryParams: {},
    };
  },

  computed: {
    queryZip: {
      get() {
        return this.$route.query.zip || "";
      },
      set(value) {
        this.pendingQueryParams.zip = value;
      },
    },

    queryRadius: {
      get() {
        return this.$route.query.radius || "";
      },
      set(value) {
        this.pendingQueryParams.radius = value;
      },
    },

    queryAppointmentType: {
      get() {
        return this.$route.query.appointment_type || "";
      },
      set(value) {
        this.pendingQueryParams.appointment_type = value;
      },
    },

    queryVaccineType: {
      get() {
        return this.$route.query.vaccine_type || "";
      },
      set(value) {
        this.pendingQueryParams.vaccine_type = value;
      },
    },

    queryProvider: {
      get() {
        return this.$route.query.provider || "";
      },
      set(value) {
        this.pendingQueryParams.provider = value;
      },
    },

    queryIncludeAll: {
      get() {
        return this.$route.query.include_all || false;
      },
      set(value) {
        this.pendingQueryParams.include_all = value;
      },
    },
  },

  methods: {
    submitForm() {
      const newQuery = { ...this.$route.query, ...this.pendingQueryParams };

      if (newQuery.zip === "") {
        delete newQuery.zip;
      }

      if (newQuery.radius === "") {
        delete newQuery.radius;
      }

      if (newQuery.appointment_type === "") {
        delete newQuery.appointment_type;
      }

      if (newQuery.vaccine_type === "") {
        delete newQuery.vaccine_type;
      }

      if (newQuery.provider === "") {
        delete newQuery.provider;
      }

      if (newQuery.include_all === false) {
        delete newQuery.include_all;
      }

      this.$router.push({
        path: this.$route.path,
        query: newQuery,
      });
      this.pendingQueryParams = {};
    },
  },
};
</script>

<style>
.location-filters {
  margin-bottom: 1rem;
}

.location-filters .form-label {
  font-weight: bold;
  margin-bottom: 0.2rem;
}

.location-filters .form-label-sm {
  font-size: 0.875rem;
}

@media (min-width: 576px) {
  .location-filters .btn-primary {
    margin-top: 1.6rem;
  }
}
</style>
