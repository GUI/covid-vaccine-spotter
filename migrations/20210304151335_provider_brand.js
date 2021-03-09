exports.up = async function (knex) {
  await knex.schema.createTable("providers", (table) => {
    table.string("id").primary();
  });

  await knex.schema.createTable("provider_brands", (table) => {
    table.increments("id").primary();
    table
      .string("provider_id")
      .references("id")
      .inTable("providers")
      .notNullable();
    table.string("key");
    table.string("name");
    table.string("url");
    table.unique(["provider_id", "key"]);
  });

  await knex.schema.table("stores", (table) => {
    table.boolean("active").defaultTo(true).notNullable();
    table.string("provider_id").references("id").inTable("providers");
    table.string("provider_location_id");
    table
      .integer("provider_brand_id")
      .references("id")
      .inTable("provider_brands");
    table.unique(["provider_id", "provider_location_id"]);
  });

  await knex.raw(
    "INSERT INTO providers (id) SELECT DISTINCT brand FROM stores ORDER BY brand"
  );
  await knex.raw(`
    WITH store_brands AS (
      SELECT
        *,
        COALESCE(
          metadata_raw->'store'->>'storeBrand',
          regexp_replace(metadata_raw->'loadLocationsForClientAndApptType'->>'clientName', '(.*) \\d+', '\\1'),
          metadata_raw->>'chain',
          brand
        ) AS sub_brand_name
      FROM stores
    ),
    brands AS (
      SELECT
        brand,
        MIN(sub_brand_name) AS sub_brand_name,
        regexp_replace(regexp_replace(lower(sub_brand_name), '[''&]', '', 'gi'), '[^a-z0-9_]+', '_', 'gi') AS sub_brand_id,
        COUNT(*)
      FROM store_brands
      GROUP BY brand, sub_brand_id
      ORDER BY brand, sub_brand_id
    )
    INSERT INTO provider_brands (provider_id, key, name)
    SELECT DISTINCT
      brand,
      sub_brand_id,
      sub_brand_name
    FROM brands
    ORDER BY brand
  `);

  await knex.raw(`
    WITH store_brands AS (
      SELECT
        *,
        COALESCE(
          metadata_raw->'store'->>'storeBrand',
          regexp_replace(metadata_raw->'loadLocationsForClientAndApptType'->>'clientName', '(.*) \\d+', '\\1'),
          metadata_raw->>'chain',
          brand
        ) AS sub_brand_name
      FROM stores
    ),
    brands AS (
      SELECT
        *,
        regexp_replace(regexp_replace(lower(sub_brand_name), '[''&]', '', 'gi'), '[^a-z0-9_]+', '_', 'gi') AS sub_brand_id
      FROM store_brands
    )
    UPDATE stores
    SET
      provider_id = stores.brand,
      provider_location_id = stores.brand_id,
      provider_brand_id = provider_brands.id
    FROM brands
    LEFT JOIN provider_brands ON brands.brand = provider_brands.provider_id AND brands.sub_brand_id = provider_brands.key
    WHERE stores.id = brands.id
  `);

  await knex.raw(
    "UPDATE stores SET active = false WHERE provider_id = 'kroger' AND state != 'CO'"
  );
};

exports.down = async function (knex) {
  await knex.schema.table("stores", (table) => {
    table.dropColumn("active");
    table.dropColumn("provider_id");
    table.dropColumn("provider_location_id");
    table.dropColumn("provider_brand_id");
  });

  await knex.schema.dropTable("provider_brands");
  await knex.schema.dropTable("providers");
};
