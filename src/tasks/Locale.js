const { GettextExtractor, JsExtractors } = require("gettext-extractor");
const {
  decorateJSParserWithVueSupport,
  decorateExtractorWithHelpers,
} = require("gettext-extractor-vue");
const vue2TemplateCompiler = require("vue-template-compiler");
const vuei18nPo = require("vuei18n-po");
const del = require("del");
const runShell = require("../utils/runShell");

class Locale {
  static async extract() {
    const extractor = decorateExtractorWithHelpers(new GettextExtractor());
    const jsParser = extractor.createJsParser([
      JsExtractors.callExpression("$t", {
        arguments: {
          text: 0,
        },
      }),
      JsExtractors.callExpression("this.$t", {
        arguments: {
          text: 0,
        },
      }),
    ]);

    const vueParser = decorateJSParserWithVueSupport(jsParser, {
      vue2TemplateCompiler,
    });
    await vueParser.parseFilesGlob("./website/**/*.{js,vue}");

    extractor.savePotFile("./website/lang/messages.pot");
    extractor.printStats();
  }

  static async upload() {
    await runShell("yarn", ["run", "localazy", "upload"]);
  }

  static async download() {
    await del("./website/lang/generated");
    await runShell("yarn", ["run", "localazy", "download"]);
    await vuei18nPo({
      po: ["website/lang/generated/*.po"],
      pluralRules: "website/lang/generated/pluralizationRules.js",
      messagesDir: "website/lang/generated",
    });
    await runShell("yarn", [
      "run",
      "prettier",
      "--write",
      "./website/lang/generated",
    ]);
  }
}

module.exports = Locale;
