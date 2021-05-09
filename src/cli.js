const { program } = require("commander");
const { Base: BaseModel } = require("./models/Base");
const runTask = require("./runTask");

async function optionalLoopEvery(task) {
  const options = program.opts();
  if (options.loopEvery) {
    return runTask(task, options.loopEvery);
  }

  return task();
}

(async () => {
  // Unset variable if it's set in local development, since it conflicts with
  // rclone: https://forum.rclone.org/t/mounting-an-amazon-s3-bucket/15106/2
  delete process.env.AWS_CA_BUNDLE;

  program.option(
    "-l, --loop-every <number>",
    "Run the task in a loop, pausing this number of milliseconds between runs.",
    (v) => parseInt(v, 10)
  );

  program.command("db:structure:dump").action(async () => {
    const Db = require("./tasks/Db");
    return optionalLoopEvery(Db.structureDump);
  });

  program.command("db:backup:public").action(async () => {
    const Db = require("./tasks/Db");
    return optionalLoopEvery(Db.backupPublic);
  });

  program.command("db:backup:private").action(async () => {
    const Db = require("./tasks/Db");
    return optionalLoopEvery(Db.backupPrivate);
  });

  program.command("db:audit:dump").action(async () => {
    const Db = require("./tasks/Db");
    return optionalLoopEvery(Db.auditDump);
  });

  program.command("locale:extract").action(async () => {
    const Locale = require("./tasks/Locale");
    return optionalLoopEvery(Locale.extract);
  });

  program.command("locale:upload").action(async () => {
    const Locale = require("./tasks/Locale");
    return optionalLoopEvery(Locale.upload);
  });

  program.command("locale:download").action(async () => {
    const Locale = require("./tasks/Locale");
    return optionalLoopEvery(Locale.download);
  });

  program.command("website:api-data:build").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.apiDataBuild);
  });

  program.command("website:api-data:publish").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.apiDataPublish);
  });

  program.command("website:api-data:build-and-publish").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.apiDataBuildAndPublish);
  });

  program.command("website:legacy-api-data:build").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.legacyApiDataBuild);
  });

  program.command("website:legacy-api-data:publish").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.legacyApiDataPublish);
  });

  program
    .command("website:legacy-api-data:build-and-publish")
    .action(async () => {
      const Website = require("./tasks/Website");
      return optionalLoopEvery(Website.legacyApiDataBuildAndPublish);
    });

  program.command("website:static-site:build").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.staticSiteBuild);
  });

  program.command("website:static-site:publish").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.staticSitePublish);
  });

  program.command("website:static-site:build-and-publish").action(async () => {
    const Website = require("./tasks/Website");
    return optionalLoopEvery(Website.staticSiteBuildAndPublish);
  });

  program
    .command("providers:albertsons:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/Albertsons/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:centura:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Centura/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program
    .command("providers:comassvax:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/CoMassVax/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:costco:find-stores").action(async () => {
    const Stores = require("./providers/Costco/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:costco:refresh-stores").action(async () => {
    const Stores = require("./providers/Costco/Stores");
    return optionalLoopEvery(Stores.refreshStores);
  });

  program.command("providers:costco:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Costco/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:cvs:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Cvs/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program
    .command("providers:denver-ball-arena:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/DenverBallArena/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:health-mart:find-stores").action(async () => {
    const Appointments = require("./providers/HealthMart/Stores");
    return optionalLoopEvery(Appointments.findStores);
  });

  program
    .command("providers:health-mart:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/HealthMart/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:heb:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Heb/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:hyvee:refresh-appointments").action(async () => {
    const Appointments = require("./providers/HyVee/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:kroger:find-stores").action(async () => {
    const Stores = require("./providers/Kroger/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:kroger:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Kroger/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:pharmaca:find-stores").action(async () => {
    const Stores = require("./providers/Pharmaca/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program
    .command("providers:pharmaca:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/Pharmaca/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:price-chopper:find-stores").action(async () => {
    const Stores = require("./providers/PriceChopper/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program
    .command("providers:price-chopper:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/PriceChopper/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:publix:find-stores").action(async () => {
    const Stores = require("./providers/Publix/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:publix:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Publix/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:rite-aid:find-stores").action(async () => {
    const Stores = require("./providers/RiteAid/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program
    .command("providers:rite-aid:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/RiteAid/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:rite-aid:find-stores").action(async () => {
    const Stores = require("./providers/RiteAid/Stores");
    return optionalLoopEvery(Stores.refreshStores);
  });

  program
    .command("providers:southeastern-grocers:find-stores")
    .action(async () => {
      const Stores = require("./providers/SoutheasternGrocers/Stores");
      return optionalLoopEvery(Stores.findStores);
    });

  program
    .command("providers:southeastern-grocers:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/SoutheasternGrocers/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:thrifty-white:find-stores").action(async () => {
    const Stores = require("./providers/ThriftyWhite/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program
    .command("providers:thrifty-white:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/ThriftyWhite/Appointments");
      return optionalLoopEvery(Appointments.refreshStores);
    });

  program.command("providers:walgreens:generate-grid").action(async () => {
    const Grid = require("./providers/Walgreens/Grid");
    return optionalLoopEvery(Grid.generateGrid);
  });

  program
    .command("providers:walgreens:refresh-appointments")
    .action(async () => {
      const Appointments = require("./providers/Walgreens/Appointments");
      return optionalLoopEvery(Appointments.refreshGridCells);
    });

  program.command("providers:walmart:find-stores").action(async () => {
    const Stores = require("./providers/Walmart/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:walmart:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Walmart/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:wegmans:find-stores").action(async () => {
    const Stores = require("./providers/Wegmans/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:wegmans:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Wegmans/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  program.command("providers:weis:find-stores").action(async () => {
    const Stores = require("./providers/Weis/Stores");
    return optionalLoopEvery(Stores.findStores);
  });

  program.command("providers:weis:refresh-appointments").action(async () => {
    const Appointments = require("./providers/Weis/Appointments");
    return optionalLoopEvery(Appointments.refreshStores);
  });

  await program.parseAsync(process.argv);
  await BaseModel.knex().destroy();
})();
