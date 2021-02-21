const albertsonsAuth = require("./auth");
const retry = require("async-retry");
const sleep = require("sleep-promise");

module.exports = async function albertsonsFetch(callback) {
  return await retry(
    async () => {
      let response;
      try {
        response = await callback();
      } catch (err) {
        console.info(
          `Error fetching data (${err.response.statusCode}), attempting to refresh auth token.`
        );
        await albertsonsAuth.refresh();
        throw err;
      }

      await sleep(1000);
      return response;
    },
    {
      retries: 2,
    }
  );
};
