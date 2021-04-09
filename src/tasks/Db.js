const execa = require("execa");
const fs = require("fs").promises;
const knexConfig = require("../../knexfile");
const logger = require("../logger");

class Db {
  static async runShell(...args) {
    const cmd = execa(...args);
    if (logger.level.levelStr === "DEBUG") {
      cmd.stdout.pipe(process.stdout);
      cmd.stderr.pipe(process.stderr);
    }
    logger.info(cmd.spawnargs.join(" "));
    await cmd;
    logger.info(`Shell command complete (${cmd.spawnargs.join(" ")})`);
    return cmd;
  }

  static async structureDump() {
    await Db.runShell(
      "pg_dump",
      [
        "--host",
        knexConfig.development.connection.host,
        "--port",
        knexConfig.development.connection.port,
        "--dbname",
        knexConfig.development.connection.database,
        "--username",
        knexConfig.development.connection.user,
        "--schema-only",
        "--no-privileges",
        "--no-owner",
        "--file",
        "db/structure.sql",
      ],
      {
        env: {
          PGPASSWORD: knexConfig.development.connection.password,
        },
      }
    );

    const migrations = await Db.runShell(
      "pg_dump",
      [
        "--host",
        knexConfig.development.connection.host,
        "--port",
        knexConfig.development.connection.port,
        "--dbname",
        knexConfig.development.connection.database,
        "--username",
        knexConfig.development.connection.user,
        "--data-only",
        "--table",
        "knex_migrations",
      ],
      {
        env: {
          PGPASSWORD: knexConfig.development.connection.password,
        },
      }
    );

    await fs.appendFile("db/structure.sql", `\n\n${migrations.stdout}`);
  }
}

module.exports = Db;
