export default metadata: {
  title: "Observador de vacunas para COVID-19",
  welcome: "Bienvenidos",
  description:
    "Una herramienta para ayudarlo de rastrear citas para la vacuna COVID-19 en las farmacias de su estado. Actualizado cada minuto.",
  longDescription:
    "En lugar de buscar en el sitio web de cada farmacia, escanearemos automáticamente los sitios web de las farmacias y le mostraremos las citas disponibles que podamos encontrar.",
},
news: {
  date: "2021/23/03",
  message:
    "Otra vez <strong>Walgreens</strong> ha comenzado a bloquear el acceso, sino que espero que las últimas soluciones deberían restaurar la disponibilidad de citas de Walgreens (nuevamente). Mientras tanto, yo tambien he agregado citas de <strong>Centura Health</strong> para usuarios de Colorado.",
  suffix:
    "Cualquier comentario es bienvenido: <a href='m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org'>vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a > o <a href='https://twitter.com/nickblah'>@nickblah</a>. ¡Y si eres un programador y tienes interés en ayudar en <a href='https://github.com/GUI/covid-vaccine-finder/issues'>GitHub</a>, eso sería estupendo (aunque el código sigue siendo complicado)!",
},
scanningDetails: {
  scanning:
    "Escaneando {chain_count} farmacias ({store_count} tiendas diferentes) en {state}",
},
searchBar: {
  zipTextField: {
    header: "Buscar citas cerca de",
    placeholder: "Ingrese un código postal de 5 dígitos",
  },
  radius: {
    header: "Dentro de",
    anyDistance: "Cualquier distancia",
    xDistance: "{distance} millas",
  },
  withoutAppointments: "Mostrar ubicaciones sin citas actuales",
  button: "Buscar",
  noResults:
    "Ahora no podemos encontrar citas abiertas para su búsqueda. Intente expandir su búsqueda o verifique nuevamente más tarde (las citas pueden aparecer y desaparecer rápidamente).",
},
buttons: {
  newAppointments: "Consultar nuevas citas",
  visitWebsite: "Visitar el sitio de web de {name}",
},
share: {
  button: { on: "Compartir en {name}", by: "Compartir por {name}" },
  sites: {
    facebook: "Facebook",
    twitter: "Twitter",
    tumblr: "Tumblr",
    email: "Correo electrónico",
    pinterest: "Pinterest",
    linkedIn: "LinkedIn",
    reddit: "Reddit",
    whatsApp: "WhatsApp",
    hackerNews: "Hacker News",
  },
},
map: {
  legend: {
    available: "Citas disponibles recientemente",
    notAvailable: "Citas no disponibles",
    unknown: "Se desconoce el estado de la cita",
  },
},
time: {
  unknown: "Hora desconocida",
},
appointments: {
  available: "Citas disponibles a partir de {date_time}",
  viewDetails: "Ver detalles de la cita",
  noneAvailable: "No hay citas disponibles desde la última verificación",
  unknown: "Estado desconocido",
  doesNotCarry:
    "En la última verificación, esta ubicación no lleva la vacuna en absoluto, y debido a esto no hemos obtenido ninguna cita.",
  notCollected: "Todavía no hemos recopilado ningún dato para esta farmacia.",
  oldData:
    '<strong>¡Ay, no!</strong> Los datos de esta farmacia son antiguos. Por favor, visita al <a href="{link} target="_blank" rel="noopener">sitio de web</a> de la farmacia directly para la disponibilidad de citas. Esto probablemente significa que la farmacia está bloqueando el acceso de nuestra herramienta a su sitio web.',
  visitWebsite: "Visitar el sito de web de {name}",
  lastChecked: "Última comprobación",
  never: "Nunca",
  viewOnWebsite:
    "Ver horarios de citas disponibles en el sito de web de {name}.",
  moreAppointments: "Ver {count} otros horarios de citas",
},
doses: {
  first: "Primera dosis",
  second: "Segunda dosis solamente - {type}",
},
store: {
  miles: "millas",
  appointmentsAvailable: "Citas disponibles a partir de",
  krogerWarning:
    "Advertencia: Muchos usuarios informan problemas para reservar citas con {name} (debido a los requisitos de la segunda cita). Sin embargo, algunos usuarios aún han informado de éxito, y por eso todavía quiero compartir los datos que tengo de las farmacias. Estoy tratando de encontrar una mejor manera de detectar estos problemas, pero mientras tanto, ¡lamento la frustración!",
  educationStaff: "Personal educativo y proveedores de cuidado infantil únicamente",
  inPhiladelphia: "en Filadelfia",
  riteAid:
    'Citas de Rite Aid solo están <a href="https://www.riteaid.com/corporate/news/-/pressreleases/news-room/2021/rite-aid-extends-covid-19-vaccine-priority-scheduling-period-for-teachers-school-staff-and-childcare-providers" target="_blank" rel="noopener"> disponibles para maestros, personal escolar y proveedores de cuidado infantil</a> en el viernes el 19 de marzo, el sábado el 20 de marzo, el viernes el 26 de marzo y el sábado el 27 de marzo<span v-show="store.properties.state === \'PA\'"> en Filadelfia (fuera de Filadelfia, otros grupos aún pueden ser elegibles)</span>. Las citas de Rite Aid deben volver a abrirse a otros grupos elegibles en otros días.',
},
status: {
  title: "Estado de la herramienta",
  columnHeaders: ["Farmacia", "Escaneando", "Última comprobación"],
  scanningCount: "{count} ubicaciones",
},
api: {
  title: "Interfaz de programación de aplicaciones (API) muy preliminar | Observador de vacunas para COVID-19",
  description:
    "Los datos legibles por máquina detrás del Observador de vacunas para COVID-19. Bien preliminario.",
  blockText:
    "Aquí están todos los datos subyacentes en formato JSON utilizados para esta herramienta. Las cosas avanzan rápido, por lo que esto está sujeto a cambios. Entonces, aunque dudo en llamar a esto cualquier tipo de API estable, quería al menos compartir lo que tengo. Si usa estos datos, tenga en cuenta que las cosas pueden cambiar. No dudes en comunicarte con nosotros para hacerme saber que estás usando esto, para que pueda avisarte sobre los cambios importantes:",
  or: "o",
  changelog: {
    beforeLink: "Suscríbete a la",
    linkText: "API Changelog",
    afterLink:
      "conversación en GitHub para recibir anuncios sobre cambios o adiciones a la API.",
  },
},
contact: {
  github: "GitHub",
  twitterHandle: "@nickblah",
},
steps: [
  {
    header:
      "Paso 1: Revise la disponibilidad de su condado y {state}'s eligibilidad",
    colorado: `Visitar <a href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated" class="text-white"><strong class="fw-bold">Colorado.gov</strong></a > para obtener información detallada sobre las opciones de vacunas de su condado y revisar si es elegible todavía.`,
    localProvider:
      "Es posible que pueda inscribirse para recibir vacunas con un proveedor de atención médica o puede haber otras opciones en su área, en cuyo caso es posible que no necesite esta herramienta.",
    eligibility:
      "Asegúrese de visitar el sitio web oficial de vacunación de su propio estado para obtener información detallada sobre las opciones de vacunas de su condado y revisar si es o no elegible todavía.",
  },
  {
    header:
      "Paso 2: Utilice esta herramienta para intentar encontrar una cita en la farmacia",
    text: [
      "Si decide que desea obtener una cita en una farmacia local (y actualmente es elegible para la vacuna), esta herramienta podría ayudarlo.",
      "En lugar de buscar en el sitio web de cada farmacia, escanearemos automáticamente los sitios web de las farmacias y le mostraremos las citas disponibles que podamos encontrar en una página.",
      "Todas las ubicaciones admitidas en {name} se escanean de forma regular y esta página se actualiza con las citas disponibles en el estado. Si no ve ubicaciones cercanas a usted en este momento, las citas pueden aparecer y desaparecer rápidamente, así que intente visitar la página en diferentes momentos durante el día.",
    ],
  },
],
_state: {
  title: "Observador de vacunas para COVID-19 para {state}",
  description: `Una herramienta para ayudarlo a rastrear las vacantes de citas para la vacuna COVID-19 en farmacias de {state}. Actualizado cada minuto.`,
},
defaultVue: {
  forDevs: "Para desarrolladores:",
  api: "API muy preliminario",
  github: "GitHub",

  about: {
    header: "Acerca de",
    text: [
      "¡Encontrar vacunas parece difícil! Con suerte, las cosas se volverán más fáciles pronto, pero mientras tanto, tal vez esto pueda ayudar. Si encuentra esto útil, no dude en compartirlo. Ponte en contacto con cualquieras preguntas:",
      'Me gustaría agregar funcionalidad adicional, (escanear farmacias adicionales y enviar notificaciones por correo electrónico o mensajes de texto cuando se abren citas) si esto resulta útil y si el tiempo lo permite. Si eres un programador de computadoras y te gustaría contribuir, el proyecto es <a href="https://github.com/GUI/covid-vaccine-finder"> fuente abierta en GitHub</a > (aunque actualmente es muy desordenado e indocumentado).',
    ],
  },
}
