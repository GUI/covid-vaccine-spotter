exports.up = async function (knex) {
  await knex.schema.createTable("walgreens_grid", (table) => {
    table.increments("id").primary();
    table.string("state_code", 2);
    table.specificType("geom", "geometry(multipolygon, 4326)");
    table.specificType("centroid_location", "geography(point, 4326)");
    table.string("centroid_postal_code");
    table.string("centroid_postal_code_state_code");
    table.string("centroid_postal_code_city");
    table.string("centroid_postal_code_county");
    table.specificType(
      "centroid_postal_code_location",
      "geography(point, 4326)"
    );
    table.specificType("centroid_land_location", "geography(point, 4326)");
    table.integer("grid_side_length");
    table.decimal("furthest_point");
    table.integer("point_count");
    table.index("geom", null, "gist");
    table.index("centroid_location", null, "gist");
    table.index("centroid_land_location", null, "gist");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("walgreens_grid");
};
