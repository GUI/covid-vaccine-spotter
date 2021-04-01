exports.up = async function (knex) {
  await knex.raw(
    "UPDATE states SET boundaries_500k = st_collectionextract(st_makevalid(boundaries_500k::geometry), 3)::geography WHERE st_isvalid(boundaries_500k::geometry) = false"
  );

  await knex.raw(`
    CREATE MATERIALIZED VIEW state_grid_500k_55km
    AS
    WITH
    country_boundary AS (
      SELECT st_union(boundaries_500k::geometry) AS geom
      FROM states
    ),
    country_grid AS (
      SELECT make_rect_grid(geom, 55000, 55000) AS geom
      FROM country_boundary
    ),
    country_grid_rows AS (
      SELECT (st_dump(geom)).geom
      FROM country_grid
    ),
    state_grid_rows AS (
      SELECT
        ST_Intersection(country_grid_rows.geom, states.boundaries_500k::geometry) AS geom,
        states.code AS state_code
      FROM country_grid_rows
      INNER JOIN states ON ST_Intersects(country_grid_rows.geom, states.boundaries_500k::geometry)
    )
    SELECT
      row_number() OVER () AS id,
      state_grid_rows.state_code,
      state_grid_rows.geom,
      centroid_geom::geography AS centroid_location,
      nearest_postal_code.postal_code AS centroid_postal_code,
      nearest_postal_code.state_code AS centroid_postal_code_state_code,
      nearest_postal_code.city AS centroid_postal_code_city,
      nearest_postal_code.county_name AS centroid_postal_code_county,
      nearest_postal_code.location AS centroid_postal_code_location,
      CASE WHEN st_intersects(centroid_geom, country_boundary.geom) THEN centroid_geom ELSE nearest_postal_code.location END AS centroid_land_location
    FROM state_grid_rows,
    country_boundary,
    st_centroid(state_grid_rows.geom) AS centroid_geom
    CROSS JOIN LATERAL (
      SELECT *
      FROM postal_codes
      ORDER BY location <-> centroid_geom::geography
      LIMIT 1
    ) nearest_postal_code
    WHERE st_area(state_grid_rows.geom) < 5
    WITH DATA;
  `);

  await knex.schema.table("state_grid_500k_55km", (table) => {
    table.index("geom", null, "gist");
    table.index("centroid_location", null, "gist");
  });

  await knex.raw("CREATE UNIQUE INDEX ON state_grid_500k_55km (id)");
};

exports.down = async function (knex) {
  await knex.raw("DROP MATERIALIZED VIEW state_grid_500k_55km");
};
