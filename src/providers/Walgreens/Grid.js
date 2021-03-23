const { Store } = require("../../models/Store");

class Grid {
  static async generateGrid() {
    const trx = await Store.startTransaction();

    await Store.knex().raw("DELETE FROM walgreens_grid");
    await Store.knex().raw(
      "INSERT INTO walgreens_grid (state_code, geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, grid_side_length) SELECT state_code, st_multi(geom), centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, round(st_perimeter(st_transform(state_grid_55km.geom, 2163)) / 4) FROM state_grid_55km"
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const gridCells = await Store.knex().raw(`
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
        await Store.knex().raw(
          `
          WITH
          grid AS (
            SELECT state_code, make_rect_grid(geom, round(grid_side_length / 2), round(grid_side_length / 2)) AS geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location
            FROM walgreens_grid WHERE id = ?
          ),
          grid_rows AS (
            SELECT state_code, (st_dump(geom)).geom AS geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location
            FROM grid
          )
          INSERT INTO walgreens_grid (state_code, geom, centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, centroid_land_location, grid_side_length)
          SELECT state_code, st_multi(geom), st_centroid(geom) AS centroid_location, centroid_postal_code, centroid_postal_code_state_code, centroid_postal_code_city, centroid_postal_code_county, centroid_postal_code_location, st_centroid(geom) AS centroid_land_location, round(st_perimeter(st_transform(geom, 2163)) / 4) FROM grid_rows
        `,
          gridCell.id
        );

        await Store.knex().raw(
          "DELETE FROM walgreens_grid WHERE id = ?",
          gridCell.id
        );
      }
    }

    await Store.knex().raw(
      "DELETE FROM walgreens_grid WHERE id IN (SELECT DISTINCT w2.id FROM walgreens_grid w1, walgreens_grid w2 WHERE w1.id != w2.id AND w1.state_code = w2.state_code AND st_within(w2.geom, w1.geom) = true)"
    );
    /*
    await Store.knex().raw(
      "DELETE FROM walgreens_grid WHERE id IN (  SELECT DISTINCT w1.id FROM walgreens_grid w1, walgreens_grid w2 WHERE w1.id != w2.id AND w1.state_code = w2.state_code AND st_intersects(w1.geom, w2.geom) = true AND st_area(st_intersection(w1.geom, w2.geom)) / st_area(w2.geom) > 0.98)"
    );
    */

    await Store.knex().raw(`
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

    await Store.knex().raw(
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
