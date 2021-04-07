const base = "https://www.vaccinespotter.org";
const statusCode = 302;

async function handleRequest(request) {
  const url = new URL(request.url);
  const { pathname, search } = url;

  const state = pathname.match(/^\/([a-z][a-z])(\/|$)/);
  if (state && state[1]) {
    const destinationURL = `${base}/${state[1].toUpperCase()}${pathname.substr(
      3
    )}${search}`;
    return Response.redirect(destinationURL, statusCode);
  }
  return fetch(request);
}

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", async (event) => {
  event.respondWith(handleRequest(event.request));
});
