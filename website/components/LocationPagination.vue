<template>
  <div>
    <div v-if="showPagination">
      <ul class="pagination justify-content-center">
        <li
          v-if="previousPage"
          :class="{
            'page-item': true,
            disabled: currentPage === previousPage.value,
          }"
        >
          <a
            href="#"
            class="page-link"
            :tabindex="currentPage === previousPage.value ? '-1' : null"
            :aria-disabled="currentPage === previousPage.value"
            @click.prevent="setPage(previousPage.value)"
            ><font-awesome-icon icon="chevron-left" />Previous</a
          >
        </li>
        <li
          v-for="page in pages"
          :key="page.key"
          :class="{
            'page-item': true,
            active: currentPage === page.value,
          }"
        >
          <a href="#" class="page-link" @click.prevent="setPage(page.value)">{{
            page.value
          }}</a>
        </li>
        <li
          v-if="nextPage"
          :class="{
            'page-item': true,
            disabled: currentPage === nextPage.value,
          }"
        >
          <a
            href="#"
            class="page-link"
            :tabindex="currentPage === nextPage.value ? '-1' : null"
            :aria-disabled="currentPage === nextPage.value"
            @click.prevent="setPage(nextPage.value)"
            >Next<font-awesome-icon icon="chevron-right"
          /></a>
        </li>
      </ul>

      <div class="text-center">
        Showing
        <select
          id="per_page"
          v-model="queryPerPage"
          name="per_page"
          class="form-select form-select-sm w-auto d-inline"
          @change="submitForm"
        >
          <option value="">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="all">All</option>
        </select>
        of {{ totalResults.toLocaleString() }} results
      </div>
    </div>
  </div>
</template>

<script>
import ultimatePagination from "ultimate-pagination";

export default {
  props: {
    totalResults: {
      type: Number,
      default: 0,
    },
  },

  data() {
    return {
      pendingQueryParams: {},
      currentPage: 1,
      previousPage: null,
      pages: [],
      nextPage: null,
    };
  },

  computed: {
    totalPages() {
      return Math.ceil(this.totalResults / this.perPage);
    },

    perPage() {
      let perPage = this.queryPerPage;
      if (perPage === "") {
        perPage = 25;
      } else if (perPage === "all") {
        perPage = this.totalResults;
      } else {
        perPage = parseInt(perPage, 10);
      }

      return perPage;
    },

    showPagination() {
      return this.totalPages > 0;
    },

    queryPerPage: {
      get() {
        return this.$route.query.per_page || "";
      },
      set(value) {
        this.pendingQueryParams.per_page = value;
      },
    },
  },

  watch: {
    perPage() {
      this.$emit("per-page", this.perPage);
    },

    totalPages() {
      this.setPage(1);
    },
  },

  created() {
    this.setPage(1);
  },

  methods: {
    setPage(page) {
      this.currentPage = page;
      if (this.totalResults === 0) {
        this.previousPage = null;
        this.nextPage = null;
        this.pages = [];
      } else {
        const pages = ultimatePagination.getPaginationModel({
          currentPage: page,
          totalPages: this.totalPages,
          boundaryPagesRange: 0,
          siblingPagesRange: 4,
          hideEllipsis: true,
          hidePreviousAndNextPageLinks: false,
          hideFirstAndLastPageLinks: true,
        });

        const previousPage = pages[0];
        const nextPage = pages[pages.length - 1];

        this.previousPage = Object.freeze(previousPage);
        this.nextPage = Object.freeze(nextPage);
        this.pages = Object.freeze(pages.slice(1, -1));
      }

      this.$emit("page", page);
    },

    submitForm() {
      const newQuery = { ...this.$route.query, ...this.pendingQueryParams };

      if (newQuery.per_page === "") {
        delete newQuery.per_page;
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
.page-link .fa-chevron-left {
  margin-right: 10px;
}

.page-link .fa-chevron-right {
  margin-left: 10px;
}
</style>
