exports.up = async function (knex) {
  await knex.schema.table("states", (table) => {
    table.specificType("boundaries", "geography(multipolygon, 4326)");
  });

  await knex.schema.table("postal_codes", (table) => {
    table.index("postal_code");
    table.index("location", null, "gist");
  });

  // Tweaked version of
  // https://github.com/LdDl/postgis-grids/blob/master/grids/make_rect_grid.sql
  // to use different SRID.
  await knex.raw(`
    CREATE OR REPLACE FUNCTION make_rect_grid(
        geom geometry,
        height_meters double precision,
        width_meters double precision,
        use_envelope bool default false,
        OUT geometry
    )
     RETURNS SETOF geometry
     LANGUAGE plpgsql
     IMMUTABLE STRICT
    AS $function$ DECLARE
        x_max DECIMAL;
        y_max DECIMAL;
        x_min DECIMAL;
        y_min DECIMAL;
        srid INTEGER := 2163;
        input_srid INTEGER;
        x_series DECIMAL;
        y_series DECIMAL;
    BEGIN
      CASE st_srid ( geom ) WHEN 0 THEN
        geom := ST_SetSRID ( geom, srid );
        RAISE NOTICE'SRID Not Found.';
      ELSE
        RAISE NOTICE'SRID Found.';
      END CASE;
      input_srid := st_srid ( geom );
      geom := st_transform ( geom, srid );
        CASE use_envelope WHEN true THEN
          geom := st_envelope(geom);
            RAISE NOTICE'Using min/max for ST_Envelope on geom';
        ELSE
            RAISE NOTICE'Using min/max for geom';
        END CASE;
      x_max := ST_XMax ( geom );
      y_max := ST_YMax ( geom );
      x_min := ST_XMin ( geom );
      y_min := ST_YMin ( geom );
      x_series := ceil ( @( x_max - x_min ) / height_meters );
      y_series := ceil ( @( y_max - y_min ) / width_meters );
      RETURN QUERY
            WITH res AS (
                SELECT
                    st_collect (st_setsrid ( ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid )) AS grid
                FROM
                    generate_series ( 0, x_series ) AS j,
                    generate_series ( 0, y_series ) AS i,
                    (
                        SELECT ( 'POLYGON((0 0, 0 ' ||$3 || ', ' ||$2 || ' ' ||$3 || ', ' ||$2 || ' 0,0 0))' ) :: geometry AS cell
                    ) AS foo WHERE ST_Intersects ( st_setsrid ( ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid ), geom )
        ) SELECT st_transform ( grid, input_srid ) FROM res;
    END;
    $function$;
  `);

  await knex.raw(`
    CREATE MATERIALIZED VIEW country_grid_75km
    AS
    WITH
    country_boundary AS (
      SELECT st_union(boundaries::geometry) AS geom
      FROM states
    ),
    country_grid AS (
      SELECT make_rect_grid(geom, 75000, 75000) AS geom
      FROM country_boundary
    ),
    country_grid_rows AS (
      SELECT (st_dump(geom)).geom
      FROM country_grid
    )
    SELECT
      geom,
      centroid_geom::geography AS centroid_location,
      nearest_postal_code.postal_code AS centroid_postal_code,
      nearest_postal_code.state_code AS centroid_postal_code_state,
      nearest_postal_code.city AS centroid_postal_code_city,
      nearest_postal_code.county_name AS centroid_postal_code_county,
      nearest_postal_code.location AS centroid_postal_code_location
    FROM country_grid_rows,
    st_centroid(geom) AS centroid_geom
    CROSS JOIN LATERAL (
      SELECT *
      FROM postal_codes
      ORDER BY location <-> centroid_geom::geography
      LIMIT 1
    ) nearest_postal_code
    WHERE st_area(geom) < 5
    WITH DATA;
  `);
};

exports.down = async function (knex) {
  await knex.raw("DROP MATERIALIZED VIEW country_grid_75km");
  await knex.raw("DROP FUNCTION make_rect_grid");

  await knex.schema.table("postal_codes", (table) => {
    table.dropIndex("postal_code");
    table.dropIndex("location");
  });

  await knex.schema.table("states", (table) => {
    table.dropColumn("boundaries");
  });
};
