<template>
  <header>
    <div
      class="navbar navbar-expand-md fixed-top navbar-dark bg-primary shadow"
    >
      <div class="container-lg">
        <div
          class="d-flex flex-fill flex-column flex-md-row align-items-center justify-content-between"
        >
          <h1 class="navbar-brand mb-0 fw-bold">
            <a
              :href="localePath('/')"
              class="text-white"
              style="text-decoration: none"
              >{{ $t("Vaccine Spotter") }}</a
            >
          </h1>
          <div v-if="usStateParam">
            <div id="navbarSupportedContent" class="collapse navbar-collapse">
              <form>
                <select
                  v-model="selectedState"
                  class="form-select form-select w-auto"
                  @change="changeState"
                >
                  <option
                    v-for="state in states"
                    :key="state.code"
                    :value="state.code"
                  >
                    {{ state.name }}
                  </option>
                </select>
              </form>
            </div>
          </div>
          <div v-if="withReload">
            <button class="btn btn-light" onclick="window.location.reload();">
              <font-awesome-icon icon="redo-alt" />
              {{ $t("Check for New Appointments") }}
            </button>
          </div>
        </div>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <font-awesome-icon icon="bars" />
        </button>
      </div>
    </div>
  </header>
</template>

<script>
// eslint-disable-next-line import/extensions
import bootstrap from "~/plugins/bootstrap";

export default {
  props: {
    title: {
      type: String,
      default: null,
    },
    usStateParam: {
      type: String,
      default: null,
    },
    withReload: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      selectedState: this.usStateParam,
      states: [
        { code: "AL", name: "Alabama" },
        { code: "AK", name: "Alaska" },
        { code: "AZ", name: "Arizona" },
        { code: "AR", name: "Arkansas" },
        { code: "CA", name: "California" },
        { code: "CO", name: "Colorado" },
        { code: "CT", name: "Connecticut" },
        { code: "DE", name: "Delaware" },
        { code: "DC", name: "District of Columbia" },
        { code: "FL", name: "Florida" },
        { code: "GA", name: "Georgia" },
        { code: "HI", name: "Hawaii" },
        { code: "ID", name: "Idaho" },
        { code: "IL", name: "Illinois" },
        { code: "IN", name: "Indiana" },
        { code: "IA", name: "Iowa" },
        { code: "KS", name: "Kansas" },
        { code: "KY", name: "Kentucky" },
        { code: "LA", name: "Louisiana" },
        { code: "ME", name: "Maine" },
        { code: "MH", name: "Marshall Islands" },
        { code: "MD", name: "Maryland" },
        { code: "MA", name: "Massachusetts" },
        { code: "MI", name: "Michigan" },
        { code: "MN", name: "Minnesota" },
        { code: "MS", name: "Mississippi" },
        { code: "MO", name: "Missouri" },
        { code: "MT", name: "Montana" },
        { code: "NE", name: "Nebraska" },
        { code: "NV", name: "Nevada" },
        { code: "NH", name: "New Hampshire" },
        { code: "NJ", name: "New Jersey" },
        { code: "NM", name: "New Mexico" },
        { code: "NY", name: "New York" },
        { code: "NC", name: "North Carolina" },
        { code: "ND", name: "North Dakota" },
        { code: "OH", name: "Ohio" },
        { code: "OK", name: "Oklahoma" },
        { code: "OR", name: "Oregon" },
        { code: "PA", name: "Pennsylvania" },
        { code: "PR", name: "Puerto Rico" },
        { code: "RI", name: "Rhode Island" },
        { code: "SC", name: "South Carolina" },
        { code: "SD", name: "South Dakota" },
        { code: "TN", name: "Tennessee" },
        { code: "TX", name: "Texas" },
        { code: "VI", name: "United States Virgin Islands" },
        { code: "UT", name: "Utah" },
        { code: "VT", name: "Vermont" },
        { code: "VA", name: "Virginia" },
        { code: "WA", name: "Washington" },
        { code: "WV", name: "West Virginia" },
        { code: "WI", name: "Wisconsin" },
        { code: "WY", name: "Wyoming" },
      ],
    };
  },

  head() {
    return {
      bodyAttrs: {
        "data-navbar": this.withReload ? "with-reload" : "",
      },
    };
  },

  mounted() {
    if (this.usStateParam) {
      // eslint-disable-next-line no-new
      new bootstrap.Collapse(document.querySelector(".collapse"), {
        toggle: false,
      });
    }
  },

  methods: {
    changeState() {
      this.$router.push(this.localePath(`/${this.selectedState}/`));
    },
  },
};
</script>

<style>
body {
  padding-top: 50px;
}

body[data-navbar="with-reload"] {
  padding-top: 88px;
}

.navbar-dark .navbar-toggler {
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.75);
  border-width: 2px;
}

h1.navbar-brand {
  font-size: 1rem;
}

.navbar-collapse {
  margin-bottom: 0.5rem;
}

@media (min-width: 768px) {
  body[data-navbar="with-reload"] {
    padding-top: 54px;
  }

  .navbar-collapse {
    margin-bottom: 0px;
  }
}

@media (min-width: 360px) {
  h1.navbar-brand {
    font-size: 1.25rem;
  }
}
</style>
