const got = require('got');
const sleep = require('sleep-promise');
const getDatabase = require('../getDatabase');

module.exports.findPharmacaStores = async () => {
  const db = await getDatabase();
  const { container } = await db.containers.createIfNotExists({
    id: 'pharmaca_stores',
  });

  const resp = await got.post(
    'https://www.pharmacarx.com/wp-admin/admin-ajax.php',
    {
      headers: {
        'User-Agent':
          'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      },
      form: {
        action: 'csl_ajax_onload',
        address: '',
        formdata: 'addressInput=',
        lat: '37.09024',
        lng: '-95.712891',
        'options[distance_unit]': 'miles',
        'options[dropdown_style]': 'none',
        'options[ignore_radius]': '0',
        'options[immediately_show_locations]': '1',
        'options[initial_radius]': '',
        'options[label_directions]': 'Directions',
        'options[label_email]': 'Email',
        'options[label_fax]': 'Fax',
        'options[label_phone]': 'Phone',
        'options[label_website]': 'Store Info & Schedule Immunization',
        'options[loading_indicator]': '',
        'options[map_center]': 'United States',
        'options[map_center_lat]': '37.09024',
        'options[map_center_lng]': '-95.712891',
        'options[map_domain]': 'maps.google.com',
        'options[map_end_icon]':
          'https://www.pharmacarx.net/wp-content/plugins/store-locator-le/images/icons/bulb_azure.png',
        'options[map_home_icon]':
          'https://www.pharmacarx.net/wp-content/plugins/store-locator-le/images/icons/bulb_yellow.png',
        'options[map_region]': 'us',
        'options[map_type]': 'roadmap',
        'options[no_autozoom]': '0',
        'options[use_sensor]': 'false',
        'options[zoom_level]': '12',
        'options[zoom_tweak]': '0',
        radius: '',
      },
      responseType: 'json',
      retry: 0,
    }
  );

  for (const store of resp.body.response) {
    if (store.name.includes('CLOSED')) {
      console.info(`Skipping closed store: ${store.name}`);
      continue;
    }

    store.id = store.id.toString();
    let webLink = store.web_link.match(/href=['"]([^'"]+)/)[1];
    if (webLink.startsWith('/')) {
      webLink = `https://www.pharmacarx.com/${webLink}`;
    }

    const webResp = await got(webLink, {
      headers: {
        'User-Agent':
          'covid-vaccine-finder (https://github.com/GUI/covid-vaccine-finder)',
      },
    });

    const scheduleId = webResp.body.match(/pharmaca.as.me\/([^'"]+)/)[1];
    store.scheduleId = scheduleId;

    await container.items.upsert(store);

    await sleep(1000);
  }
};

module.exports.findPharmacaStores();
