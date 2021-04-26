<template>
  <div>
    <div v-show="instructionsVisible" id="instructions" class="row">
      <div class="col-md-6">
        <div class="card card-body h-100 bg-primary text-white shadow-sm">
          <h2 class="display-6 text-center mb-4">
            {{
              $t(
                "Step 1: Review your county's availability and {state}'s eligibility",
                { state: usStateCode }
              )
            }}
          </h2>
          <template v-if="usStateCode === 'CO'">
            <!-- eslint-disable vue/no-v-html -->
            <p
              class="lead"
              v-html="
                $t(
                  'Visit <a href=\u0022https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated\u0022 class=\u0022text-white\u0022><strong class=\u0022fw-bold\u0022>Colorado.gov</strong></a> for detailed information about your county\'s vaccine options and review whether or not you are eligible yet.'
                )
              "
            />
            <!-- eslint-enable vue/no-v-html -->
            <p class="lead">
              {{
                $t(
                  "You may be able to signup for vaccines with a health care provider or there may be other options in your area, in which case you may not need this tool."
                )
              }}
            </p>
            <a
              href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated"
              class="btn btn-light fw-bold fs-5 text-primary"
              >{{ $t("Visit Colorado.gov") }}
              <font-awesome-icon icon="arrow-alt-circle-right"
            /></a>
          </template>
          <template v-else>
            <p class="lead">
              {{
                $t(
                  "Be sure to visit your own state's official vaccination website for detailed information about your county's vaccine options and review whether or not you are eligible yet."
                )
              }}
            </p>
            <p class="lead">
              {{
                $t(
                  "You may be able to signup for vaccines with a health care provider or there may be other options in your area, in which case you may not need this tool."
                )
              }}
            </p>
          </template>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card card-body h-100 bg-primary text-white shadow-sm">
          <h2 class="display-6 text-center mb-4">
            {{
              $t("Step 2: Use this tool to try and find a pharmacy appointment")
            }}
          </h2>
          <p class="lead">
            {{
              $t(
                "If you decide you want to find an appointment at a local pharmacy (and are currently eligible for the vaccine), this tool might be able to help."
              )
            }}
          </p>
          <p class="lead">
            {{
              $t(
                "Rather than searching around on each pharmacy's website, we'll automatically scan the pharmacy websites and show you any available appointments we can find on one page."
              )
            }}
          </p>
          <p class="lead">
            {{
              $t(
                "All supported locations in {state} are scanned on a regular basis and this page is updated with any available appointments in the state. If you don't see locations near you right now, appointments can come and go quickly so try visiting the page at different times throughout the day.",
                { state: usStateName }
              )
            }}
          </p>
        </div>
      </div>
    </div>

    <div v-show="instructionsVisible" class="text-center instructions-toggle">
      <button
        class="btn btn-link btn-sm"
        type="button"
        @click="hideInstructions"
      >
        {{ $t("Hide instructions") }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    usState() {
      return this.$store.state.usStates.usState;
    },

    usStateCode() {
      return this.usState?.metadata?.code;
    },

    usStateName() {
      return this.usState?.metadata?.name;
    },

    instructionsVisible() {
      return this.$store.state.instructions.visible;
    },
  },

  methods: {
    hideInstructions() {
      this.$store.commit("instructions/setVisible", false);
    },
  },
};
</script>

<style>
#instructions .col-md-6 {
  margin-bottom: 1rem;
}

.instructions-toggle {
  margin-top: 0.1rem;
  margin-bottom: 0.7rem;
}

.instructions-toggle button {
  padding: 0.15rem 0.3rem;
}

@media (min-width: 768px) {
  #instructions .col-md-6 {
    margin-bottom: 0rem;
  }
}
</style>
