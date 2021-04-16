module.exports = function throwCurlResponseError(resp) {
  if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
    const err = new Error(`Request failed with status code ${resp.statusCode}`);
    err.response = resp;
    throw err;
  }

  return resp;
};
