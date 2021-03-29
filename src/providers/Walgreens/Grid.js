const { Store } = require("../../models/Store");

class Grid {
  static async generateGrid() {
    const trx = await Store.startTransaction();

    await trx.raw("DELETE FROM walgreens_grid");
    await trx.raw(
      "INSERT INTO walgreens_grid (state_code, geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, grid_side_length) SELECT state_code, st_multi(geom), centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, round(st_perimeter(st_transform(state_grid_55km.geom, 2163)) / 4) FROM state_grid_55km"
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const gridCells = await trx.raw(`
        SELECT
          walgreens_grid.id,
          walgreens_grid.geom,
          round(st_perimeter(st_transform(walgreens_grid.geom, 2163)) / 4) AS grid_side_length,
          COUNT(stores.id) AS point_count
        FROM walgreens_grid, stores
        WHERE stores.provider_id = 'walgreens'
          AND stores.state = walgreens_grid.state_code
          AND st_intersects(stores.location, walgreens_grid.geom)
        GROUP BY walgreens_grid.id, walgreens_grid.geom
        HAVING COUNT(stores.id) >= 8
      `);

      if (gridCells.rows.length === 0) {
        break;
      }

      for (const gridCell of gridCells.rows) {
        await trx.raw(
          `
          WITH
          grid AS (
            SELECT state_code, geom AS parent_geom, make_rect_grid(geom, round(grid_side_length / 2), round(grid_side_length / 2)) AS geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location
            FROM walgreens_grid WHERE id = ?
          ),
          grid_rows AS (
            SELECT state_code, parent_geom, (st_dump(geom)).geom AS geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location
            FROM grid
          )
          INSERT INTO walgreens_grid (state_code, geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, grid_side_length)
          SELECT state_code, st_multi(geom), st_centroid(geom) AS centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, st_centroid(geom) AS centroid_land_location, round(st_perimeter(st_transform(geom, 2163)) / 4) FROM grid_rows
            WHERE st_area(st_intersection(geom, parent_geom)) / st_area(geom) > 0.01
        `,
          gridCell.id
        );

        await trx.raw("DELETE FROM walgreens_grid WHERE id = ?", gridCell.id);
      }
    }

    await trx.raw(
      "DELETE FROM walgreens_grid AS w1 USING walgreens_grid AS w2 WHERE w1.id > w2.id AND st_equals(w1.geom, w2.geom)"
    );

    const storesWithoutGridCells = await trx.raw(`
      SELECT s.* FROM stores AS s
        LEFT JOIN walgreens_grid AS g ON s.state = g.state_code AND st_intersects(s.location, g.geom)
        WHERE s.provider_id = 'walgreens'
        AND g.id IS NULL
    `);
    for (const storeWithoutGridCell of storesWithoutGridCells.rows) {
      await trx.raw(
        `
        WITH
        grid AS (
          SELECT state AS state_code, make_rect_grid(st_buffer(location, 1000)::geometry, 1000, 1000) AS geom, location AS centroid_location, postal_code AS centroid_postal_code, state AS centroid_postal_code_state_code, city AS centroid_postal_code_city, location AS centroid_postal_code_location, location AS centroid_land_location
          FROM stores WHERE id = ?
        ),
        grid_rows AS (
          SELECT state_code, (st_dump(geom)).geom AS geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_location, centroid_land_location
          FROM grid
        )
        INSERT INTO walgreens_grid (state_code, geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_location, centroid_land_location, grid_side_length)
        SELECT state_code, st_multi(geom), st_centroid(geom) AS centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_location, st_centroid(geom) AS centroid_land_location, round(st_perimeter(st_transform(geom, 2163)) / 4) FROM grid_rows
      `,
        storeWithoutGridCell.id
      );
    }

    await trx.raw(`
      WITH summary AS (
        SELECT
          walgreens_grid.id,
          walgreens_grid.geom,
          MAX(st_distance(stores.location, walgreens_grid.centroid_land_location)) AS furthest_point,
          COUNT(stores.id) AS point_count
        FROM walgreens_grid, stores
        WHERE stores.provider_id = 'walgreens'
          AND stores.state = walgreens_grid.state_code
          AND st_intersects(stores.location, walgreens_grid.geom)
        GROUP BY walgreens_grid.id, walgreens_grid.geom
      )
      UPDATE walgreens_grid
      SET point_count = summary.point_count, furthest_point = summary.furthest_point
      FROM summary
      WHERE walgreens_grid.id = summary.id
    `);

    await trx.raw(
      "DELETE FROM walgreens_grid WHERE point_count IS NULL OR point_count = 0"
    );

    try {
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    await Store.knex().destroy();
  }
}

module.exports = Grid;
