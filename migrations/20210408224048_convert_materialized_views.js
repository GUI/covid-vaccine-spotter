exports.up = async function (knex) {
  await knex.raw(
    "CREATE TABLE country_grid_110km_real (LIKE country_grid_110km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO country_grid_110km_real SELECT * FROM country_grid_110km"
  );
  await knex.raw("DROP MATERIALIZED VIEW country_grid_110km");
  await knex.raw(
    "ALTER TABLE country_grid_110km_real RENAME TO country_grid_110km"
  );
  await knex.raw("ALTER TABLE country_grid_110km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX country_grid_110km_real_centroid_location_idx RENAME TO country_grid_110km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX country_grid_110km_real_geom_idx RENAME TO country_grid_110km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE country_grid_11km_real (LIKE country_grid_11km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO country_grid_11km_real SELECT * FROM country_grid_11km"
  );
  await knex.raw("DROP MATERIALIZED VIEW country_grid_11km");
  await knex.raw(
    "ALTER TABLE country_grid_11km_real RENAME TO country_grid_11km"
  );
  await knex.raw("ALTER TABLE country_grid_11km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX country_grid_11km_real_centroid_location_idx RENAME TO country_grid_11km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX country_grid_11km_real_geom_idx RENAME TO country_grid_11km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE country_grid_220km_real (LIKE country_grid_220km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO country_grid_220km_real SELECT * FROM country_grid_220km"
  );
  await knex.raw("DROP MATERIALIZED VIEW country_grid_220km");
  await knex.raw(
    "ALTER TABLE country_grid_220km_real RENAME TO country_grid_220km"
  );
  await knex.raw("ALTER TABLE country_grid_220km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX country_grid_220km_real_centroid_location_idx RENAME TO country_grid_220km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX country_grid_220km_real_geom_idx RENAME TO country_grid_220km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE country_grid_22km_real (LIKE country_grid_22km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO country_grid_22km_real SELECT * FROM country_grid_22km"
  );
  await knex.raw("DROP MATERIALIZED VIEW country_grid_22km");
  await knex.raw(
    "ALTER TABLE country_grid_22km_real RENAME TO country_grid_22km"
  );
  await knex.raw("ALTER TABLE country_grid_22km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX country_grid_22km_real_centroid_location_idx RENAME TO country_grid_22km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX country_grid_22km_real_geom_idx RENAME TO country_grid_22km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE country_grid_55km_real (LIKE country_grid_55km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO country_grid_55km_real SELECT * FROM country_grid_55km"
  );
  await knex.raw("DROP MATERIALIZED VIEW country_grid_55km");
  await knex.raw(
    "ALTER TABLE country_grid_55km_real RENAME TO country_grid_55km"
  );
  await knex.raw("ALTER TABLE country_grid_55km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX country_grid_55km_real_centroid_location_idx RENAME TO country_grid_55km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX country_grid_55km_real_geom_idx RENAME TO country_grid_55km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE state_grid_110km_real (LIKE state_grid_110km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_110km_real SELECT * FROM state_grid_110km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_110km");
  await knex.raw(
    "ALTER TABLE state_grid_110km_real RENAME TO state_grid_110km"
  );
  await knex.raw("ALTER TABLE state_grid_110km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_110km_real_centroid_location_idx RENAME TO state_grid_110km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_110km_real_geom_idx RENAME TO state_grid_110km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE state_grid_11km_real (LIKE state_grid_11km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_11km_real SELECT * FROM state_grid_11km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_11km");
  await knex.raw("ALTER TABLE state_grid_11km_real RENAME TO state_grid_11km");
  await knex.raw("ALTER TABLE state_grid_11km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_11km_real_centroid_location_idx RENAME TO state_grid_11km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_11km_real_geom_idx RENAME TO state_grid_11km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE state_grid_220km_real (LIKE state_grid_220km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_220km_real SELECT * FROM state_grid_220km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_220km");
  await knex.raw(
    "ALTER TABLE state_grid_220km_real RENAME TO state_grid_220km"
  );
  await knex.raw("ALTER TABLE state_grid_220km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_220km_real_centroid_location_idx RENAME TO state_grid_220km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_220km_real_geom_idx RENAME TO state_grid_220km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE state_grid_22km_real (LIKE state_grid_22km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_22km_real SELECT * FROM state_grid_22km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_22km");
  await knex.raw("ALTER TABLE state_grid_22km_real RENAME TO state_grid_22km");
  await knex.raw("ALTER TABLE state_grid_22km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_22km_real_centroid_location_idx RENAME TO state_grid_22km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_22km_real_geom_idx RENAME TO state_grid_22km_geom_index"
  );

  await knex.raw(
    "CREATE TABLE state_grid_500k_55km_real (LIKE state_grid_500k_55km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_500k_55km_real SELECT * FROM state_grid_500k_55km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_500k_55km");
  await knex.raw(
    "ALTER TABLE state_grid_500k_55km_real RENAME TO state_grid_500k_55km"
  );
  await knex.raw("ALTER TABLE state_grid_500k_55km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_500k_55km_real_centroid_location_idx RENAME TO state_grid_500k_55km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_500k_55km_real_geom_idx RENAME TO state_grid_500k_55km_geom_index"
  );
  await knex.raw("DROP INDEX state_grid_500k_55km_real_id_idx");

  await knex.raw(
    "CREATE TABLE state_grid_55km_real (LIKE state_grid_55km INCLUDING ALL)"
  );
  await knex.raw(
    "INSERT INTO state_grid_55km_real SELECT * FROM state_grid_55km"
  );
  await knex.raw("DROP MATERIALIZED VIEW state_grid_55km");
  await knex.raw("ALTER TABLE state_grid_55km_real RENAME TO state_grid_55km");
  await knex.raw("ALTER TABLE state_grid_55km ADD PRIMARY KEY (id)");
  await knex.raw(
    "ALTER INDEX state_grid_55km_real_centroid_location_idx RENAME TO state_grid_55km_centroid_location_index"
  );
  await knex.raw(
    "ALTER INDEX state_grid_55km_real_geom_idx RENAME TO state_grid_55km_geom_index"
  );
};

exports.down = function () {};
