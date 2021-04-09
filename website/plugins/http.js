export default ({ $http, $rollbar }) => {
  $http.onError((error) => {
    /* eslint-disable no-console */
    if (console && console.error) {
      console.error("HTTP error", error);
      console.error("HTTP error.response", error?.response);
    }

    if ($rollbar) {
      $rollbar.error(error, {
        response: error?.response,
        responseData: error?.response?.data,
        responseHeaders: error?.response?.headers,
        responseStatus: error?.response?.status,
        responseStatusText: error?.response?.statusText,
        responseUrl: error?.response?.url,
      });
    }
  });
};
