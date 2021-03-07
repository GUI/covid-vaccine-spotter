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
          />
        </div>
        <div class="col-sm-auto">
          <label for="radius" class="form-label">Within</label>
          <select
            id="radius"
            v-model="queryRadius"
            name="radius"
            class="form-select form-select-lg mb-3"
          >
            <option value="" selected>Any distance</option>
            <option value="5">5 miles</option>
            <option value="10">10 miles</option>
            <option value="25">25 miles</option>
            <option value="50">50 miles</option>
            <option value="100">100 miles</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-auto">
          <div class="form-check">
            <input
              id="include_all"
              v-model="queryIncludeAll"
              name="include_all"
              value="true"
              class="form-check-input"
              type="checkbox"
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
    }
  },

  computed: {
    queryZip: {
      get() {
        return this.$route.query.zip || ''
      },
      set(value) {
        this.pendingQueryParams.zip = value
      },
    },

    queryRadius: {
      get() {
        return this.$route.query.radius || ''
      },
      set(value) {
        this.pendingQueryParams.radius = value
      },
    },

    queryIncludeAll: {
      get() {
        return this.$route.query.include_all || false
      },
      set(value) {
        this.pendingQueryParams.include_all = value
      },
    },
  },

  methods: {
    submitForm() {
      const newQuery = { ...this.$route.query, ...this.pendingQueryParams }

      if (newQuery.zip === '') {
        delete newQuery.zip
      }

      if (newQuery.radius === '') {
        delete newQuery.radius
      }

      if (newQuery.include_all === false) {
        delete newQuery.include_all
      }

      this.$router.push({
        path: this.$route.path,
        query: newQuery,
      })
      this.pendingQueryParams = {}
    },
  },
}
</script>

<style>
.location-filters {
  margin-bottom: 1rem;
}

.location-filters .form-label {
  font-weight: bold;
  margin-bottom: 0.2rem;
}

@media (min-width: 576px) {
  .location-filters .btn-primary {
    margin-top: 1.6rem;
  }
}
</style>
