<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" />

    <main class="container-lg">
      <p
        class="lead text-center text-muted py-2 py-lg-4"
        style="padding-bottom: 0px !important"
      >
        {{ description }}
      </p>

      <div class="alert alert-danger my-4" role="alert">
        <p>
          Here's all of the underlying data in JSON format used for this tool.
          While I'm trying to maintain compatibility with the existing format,
          things can sometimes move fast, so I'm hesitant to declare this a
          fully stable API. But hopefully it should be stable-ish if you want to
          build anything on top of it, just be aware things may change.
        </p>

        <p class="mb-0">
          Subscribe to the
          <a href="https://github.com/GUI/covid-vaccine-spotter/discussions/27"
            >API Changelog</a
          >
          discussion on GitHub for announcements on any API changes or
          additions.
        </p>
      </div>

      <ul>
        <li>
          <code><a href="/api/v0/states.json">/api/v0/states.json</a></code>
        </li>
        <li v-for="state in activeStates" :key="state.code">
          <code
            ><a :href="`/api/v0/states/${state.code}.json`"
              >/api/v0/states/{{ state.code }}.json</a
            ></code
          >
        </li>
      </ul>

      <h3 id="api-fields">API Fields</h3>

      <ul>
        <li>
          <strong><code>features[].properties.id</code>:</strong> Vaccine
          Spotter's own unique ID for this location.
        </li>
        <li>
          <strong><code>features[].properties.provider</code>:</strong> A unique
          key representing the pharmacy or provider this location belongs to.
        </li>
        <li>
          <strong
            ><code>features[].properties.provider_location_id</code>:</strong
          >
          The provider's own unique ID to represent this location (eg, store
          number, or other identifier). Unique in combination with
          <code>provider</code>.
        </li>
        <li>
          <strong
            ><code>features[].properties.appointments_available</code>:</strong
          >
          Boolean value as to whether or not appointments are currently
          available at this location as of last check.
        </li>
        <li>
          <strong><code>features[].properties.appointments</code>:</strong>
          If <code>appointments_available</code> is true, then for some
          providers, this field contains an array of additional details on the
          specific appointment timeslots, vaccine types, etc. This more detailed
          information is not available for all providers, and the amount of
          detail varies for each provider.
        </li>
        <li>
          <strong
            ><code>features[].properties.appointments_last_fetched</code
            >:</strong
          >
          ISO8601 time of when the appointment data was last fetched from the
          provider's website for this specific location.
        </li>
        <li>
          <strong
            ><code>features[].properties.appointments_last_modified</code
            >:</strong
          >
          ISO8601 time of when the appointment data was last modified. In most
          cases, this will mirror <code>appointments_last_fetched</code>, but
          for some providers this may reflect an older time if we refresh the
          provider's website more frequently, but the provider's data indicates
          it is older.
        </li>
        <li>
          <strong><code>features[].properties.carries_vaccine</code>:</strong>
          This field is mostly for internal processing usage. Locations may
          carry the vaccine if this field is <code>true</code> or
          <code>null</code> (<code>null</code> just indicates this field isn't
          really used for a specific provider).
        </li>
      </ul>

      <h3 id="api-usage">API Usage</h3>

      <ul>
        <li>
          <strong>License:</strong> You're welcome to do whatever you'd like
          with this data. If you use this data, I would appreciate linking back
          to Vaccine Spotter (just in the hopes that feedback on the data could
          help improve the quality of it), but it is not required.
        </li>
        <li>
          <strong>Rate Limits:</strong> There are no rate limits for accessing
          the API. Data is updated approximately once a minute, so refreshing
          more often than that may not have benefits.
        </li>
      </ul>

      <h3 id="historical">Historical Data</h3>

      <p>
        If you're interested in historical analysis of the appointments data, I
        have been collecting raw data of all appointment changes that have been
        detected since 2021-02-26.
      </p>

      <p>
        This historical data is based on
        <a href="https://github.com/m-martinez/pg-audit-json"
          >PostgreSQL table auditing</a
        >, so it captures any changes detected in the underlying database
        tables. This may not be the most ideal design for this, but it does
        capture all of the possible changes (changes in overall appointment
        availability, changes in the specific appointment slots available, etc).
      </p>
      <ul>
        <li>
          <strong>UTC Date Files:</strong> The audit records are organized into
          separate files for each complete UTC date.
        </li>
        <li>
          <strong>Gzipped JSON Lines Format:</strong> Each file is a gzipped
          <a href="https://jsonlines.org">JSON Lines</a> file. This format is
          simply a file where each line is a JSON object (but it's not
          technically a JSON array to make it easier to read the sometime large
          files line-by-line).
        </li>
        <li>
          <strong>Exclusions:</strong> Some change events were explicitly
          excluded from the audit records for the sake of space. If
          <em>only</em> the following fields were being updated on a record,
          then auditing was skipped: <code>created_at</code>,
          <code>updated_at</code>, <code>metadata_raw</code>,
          <code>appointments_raw</code>, <code>appointments_last_fetched</code>.
        </li>
        <li>
          <strong>Fields:</strong>
          <ul>
            <li>
              <strong><code>transaction_timestamp</code>:</strong> The time this
              audit change event occurred in the database.
            </li>
            <li>
              <strong><code>action:</code></strong> Indicates whether a
              <code>INSERT</code>, <code>UPDATE</code>, or
              <code>DELETE</code> statement was responsible for the audit
              change.
            </li>
            <li>
              <strong><code>previous_data:</code></strong> The complete data on
              this record as it existed just before the current transaction is
              about to take place and alter the record. Note that because some
              change events are excluded (see above), this previous data may
              contain data that wasn't previously in the audit history logs (so
              this is not necessarily the data that was previously audited for a
              record).
            </li>
            <li>
              <strong><code>changed_data:</code></strong> The specific fields
              and data that is being updated on this record as part of this
              change.
            </li>
            <li>
              <strong><code>data:</code></strong> The final set of data that
              exists after this transaction takes place.
            </li>
          </ul>
        </li>
      </ul>

      <ul>
        <li v-for="file in historyDays.files" :key="file.name">
          <code
            ><a
              :href="`https://www.vaccinespotter.org/database/history/${file.name}`"
              >/database/history/{{ file.name }}</a
            >
            ({{ Math.round(file.size / 1000000) }} MB)</code
          >
        </li>
        <li>
          <code
            ><a href="https://www.vaccinespotter.org/database/history/days.json"
              >/database/history/days.json</a
            ></code
          >: A list of the available historical files. Updated whenever new
          daily files are available.
        </li>
        <li>
          <code
            ><a href="https://www.vaccinespotter.org/database/stores.jsonl.gz"
              >/database/stores.jsonl.gz</a
            ></code
          >: A daily snapshot of the latest stores database table in the same
          JSON Lines format as the rest of the historical data.
        </li>
      </ul>
    </main>
  </div>
</template>

<script>
export default {
  async asyncData({ $http }) {
    const statesPromise = $http.$get(`/api/v0/states.json`);
    const historyDaysPromise = $http.$get(
      `https://www.vaccinespotter.org/database/history/days.json`
    );

    const states = Object.freeze(await statesPromise);
    const historyDays = Object.freeze(await historyDaysPromise);

    return { states, historyDays };
  },

  data() {
    return {
      title: "Very Beta API | COVID-19 Vaccine Spotter",
      description:
        "The machine readable data behind the COIVD-19 Vaccine Spotter tool. Very beta.",
      states: [],
      historyDays: {
        files: [],
      },
    };
  },

  computed: {
    activeStates() {
      return this.states.filter((state) => state.store_count > 0);
    },
  },
};
</script>

<style></style>
