var _ = require("lodash");
const got = require("got");
const getDatabase = require("./getDatabase");
const albertsonsAuth = require("./albertsonsAuth");

(async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: "albertsons_stores",
  });
  console.info("db: ", db);
  console.info("container: ", container);

  const auth = await albertsonsAuth();

  /*
  const resp = await got('https://www.mhealthappointments.com/views/assets/js/vaccinationRandalls.json', {
    searchParams: {
      v: '1613161241898',
    },
    responseType: 'json',
  });
  for (const store of resp.body) {
    store.id = store.id.toString();
    const { resource } = await container.item(store.id).read();
    if (!resource) {
      await container.items.create(store);
    }
  }
  */

  const { resources } = await container.items
    .query("SELECT * from c WHERE c.region LIKE 'Colorado%'")
    .fetchAll();
  console.info(resources.length);
  for (const storeChunk of _.chunk(resources, 100)) {
    await new Promise((r) => setTimeout(r, 2000));

    const resp = await got(
      "https://kordinator.mhealthcoach.net/loadLocationsForClientAndApptType.do",
      {
        searchParams: {
          _r: "2598477964194206",
          apptKey: "COVID_VACCINE_DOSE1_APPT",
          clientIds: _.map(storeChunk, "id").join(","),
          csrfKey: auth.body.csrfKey,
          externalClientId: auth.body.data.id,
          instore: "yes",
        },
        cookieJar: auth.cookieJar,
        responseType: "json",
      }
    );
    console.info(resp);
    console.info(resp.headers);
    console.info(resp.body);
    for (const store of resp.body) {
      console.log(store);
      store.id = store.clientId.toString();
      delete store.clientId;

      const item = container.item(store.id);
      const { resource } = await item.read();

      const newResource = {
        ...resource,
        ...store,
      };
      if (newResource !== resource) {
        item.replace(newResource);
      }
    }
  }
})();
