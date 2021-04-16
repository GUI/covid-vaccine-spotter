const execa = require("execa");
const logger = require("../logger");

module.exports = async function runShell(...args) {
  const cmd = execa(...args);
  if (logger.level.levelStr === "DEBUG") {
    cmd.stdout.pipe(process.stdout);
    cmd.stderr.pipe(process.stderr);
  }
  logger.info(cmd.spawnargs.join(" "));
  await cmd;
  logger.info(`Shell command complete (${cmd.spawnargs.join(" ")})`);
  return cmd;
};
