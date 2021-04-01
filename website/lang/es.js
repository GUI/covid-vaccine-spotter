export default {
  metadata: {
    title: "Observador de vacunas para COVID-19",
    welcome: "Bienvenid@",
    description:
      "Una herramienta para ayudarte a rastrear citas para la vacuna COVID-19 en las farmacias de tu estado. Actualizado cada minuto.",
    longDescription:
      "En lugar de buscar en el sitio web de cada farmacia, escanearemos automáticamente los sitios web de las farmacias y te mostraremos las citas disponibles que podamos encontrar.",
  },
  news: {
    date: "2021/25/03",
    message:
      "<strong>¡Nuevas características!</strong> 🌟 Filtrar por tipo de vacuna (Moderna, Pfizer, J&J), tipo de cita (por ejemplo, si solo necesitas una segunda dosis) y farmacia. Sé que estas han sido características solicitadas con frecuencia, ¡así que espero que te ayuden en tu búsqueda de vacunas!",
    suffix:
      "Cualquier comentario es bienvenido: <a href='m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org'>vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a > o <a href='https://twitter.com/nickblah'>@nickblah</a>. ¡Y si eres programador(a) y tienes interés en ayudar en <a href='https://github.com/GUI/covid-vaccine-finder/issues'>GitHub</a>, eso sería estupendo (aunque el código sigue siendo complicado)!",
  },
  scanningDetails: {
    scanning:
      "Escaneando {chain_count} farmacias ({store_count} tiendas diferentes) en {state_name}",
  },
  searchBar: {
    zipTextField: {
      header: "Buscar citas cerca de",
      placeholder: "Ingresa un código postal de 5 dígitos",
    },
    radius: {
      header: "Dentro de",
      anyDistance: "Cualquier distancia",
      xDistance: "{distance} millas",
    },
    filter: {
      appointmentType: {
        title: "Tipo de cita",
        options: ["Todas las dosis", "Segunda dosis solamente"],
      },
      vaccineType: {
        title: "Tipo de vacuna",
        options: [
          "Todas",
          "Johnson and Johnson",
          "Moderna",
          "Pfizer",
          "Desconocida",
        ],
      },
      pharmacy: {
        title: "Farmacia",
        all: "Todas",
      },
    },
    withoutAppointments: "Mostrar ubicaciones sin citas actuales",
    button: "Buscar",
    noResults:
      "Ahora no podemos encontrar citas disponibles para tu búsqueda. Intenta expandir tu búsqueda o verifica nuevamente más tarde (las citas pueden aparecer y desaparecer rápidamente).",
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
      unknown: "Se desconoce el estado de las citas",
    },
  },
  time: {
    unknown: "Hora desconocida",
  },
  appointments: {
    available: "Citas disponibles a partir de",
    viewDetails: "Ver detalles de la cita",
    noneAvailable: "No hay citas disponibles desde la última verificación",
    unknown: "Estado desconocido",
    doesNotCarry:
      "En la última verificación, esta ubicación no lleva la vacuna en absoluto, y debido a esto no hemos obtenido ninguna cita.",
    notCollected: "Todavía no hemos recopilado ningún dato para esta farmacia.",
    oldData:
      '<strong>¡Ay, no!</strong> Los datos de esta farmacia son antiguos. Por favor, visita el <a href="{link} target="_blank" rel="noopener">sitio de web</a> de la farmacia directamente para la disponibilidad de citas. Esto probablemente significa que la farmacia está bloqueando el acceso de nuestra herramienta a su sitio web.',
    visitWebsite: "Visitar el sito web de {name}",
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
    appointmentsAvailable: "Citas disponibles a partir del",
    krogerWarning:
      "Advertencia: Muchos usuarios informan problemas para reservar citas con {name} (debido a los requisitos de la segunda cita). Sin embargo, algunos usuarios aún han informado de éxito, y por eso todavía quiero compartir los datos que tengo de las farmacias. Estoy tratando de encontrar una mejor manera de detectar estos problemas, pero mientras tanto, ¡lamento la frustración!",
    educationStaff:
      "Personal educativo y proveedores de cuidado infantil únicamente",
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
    title:
      "Interfaz de programación de aplicaciones (API) muy preliminar | Observador de vacunas para COVID-19",
    description:
      "Los datos legibles por máquina detrás del Observador de vacunas para COVID-19. Bien preliminario.",
    blockText:
      "Aquí están todos los datos subyacentes en formato JSON utilizados para esta herramienta. Las cosas avanzan rápido, por lo que esto está sujeto a cambios. Entonces, aunque dudo en llamar a esto cualquier tipo de API estable, quería al menos compartir lo que tengo. Si usas estos datos, ten en cuenta que las cosas pueden cambiar. No dudes en comunicarte con nosotros para hacerme saber que estás usando esto, para que pueda avisarte sobre los cambios importantes:",
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
        "Paso 1: Revise la disponibilidad de su condado y la eligibilidad de {state_name}",
      colorado: `Visitar <a href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated" class="text-white"><strong class="fw-bold">Colorado.gov</strong></a > para obtener información detallada sobre las opciones de vacunas de su condado y revisar si es elegible todavía.`,
      visitColorado: "Visite Colorado.gov",
      localProvider:
        "Es posible que puedas inscribirte para recibir vacunas con un proveedor de atención médica o puede haber otras opciones en tu área, en cuyo caso es posible que no necesites esta herramienta.",
      eligibility:
        "Asegúrate de visitar el sitio web oficial de vacunación de tu propio estado para obtener información detallada sobre las opciones de vacunas de tu condado y revisar si eres o no elegible todavía.",
    },
    {
      header:
        "Paso 2: Utiliza esta herramienta para intentar encontrar una cita en la farmacia",
      text: [
        "Si deseas obtener una cita en una farmacia local (y actualmente eres elegible para la vacuna), esta herramienta podría ayudarte.",
        "En lugar de buscar en el sitio web de cada farmacia, escanearemos automáticamente los sitios web de las farmacias y te mostraremos las citas disponibles que podamos encontrar en una página.",
        "Todas las ubicaciones admitidas en {state_name} se escanean de forma regular y esta página se actualiza con las citas disponibles en el estado. Si no ves ubicaciones cercanas a ti en este momento, las citas pueden aparecer y desaparecer rápidamente, así que intenta visitar la página en diferentes momentos durante el día.",
      ],
    },
  ],
  _state: {
    title: "Observador de vacunas para COVID-19 para {state}",
    description: `Una herramienta para ayudarte a rastrear las vacantes de citas para la vacuna COVID-19 en farmacias en su estado. Actualizado cada minuto.`,
  },
  defaultVue: {
    forDevs: "Para desarrollador@s:",
    api: "API muy preliminario",
    github: "GitHub",
    about: {
      header: "Acerca de",
      text: [
        "¡Encontrar vacunas parece difícil! Con suerte, las cosas se volverán más fáciles pronto, pero mientras tanto, tal vez esto pueda ayudar. Si encuentras esto útil, no dudes en compartirlo. Ponte en contacto con cualquier preguntas:",
        'Me gustaría agregar funcionalidad adicional, (escanear farmacias adicionales y enviar notificaciones por correo electrónico o mensajes de texto cuando se abren citas) si esto resulta útil y si el tiempo lo permite. Si eres programador@ de computadoras y te gustaría contribuir, el proyecto es <a href="https://github.com/GUI/covid-vaccine-finder"> código abierto (open source) en GitHub</a > (aunque actualmente es muy desordenado e indocumentado).',
      ],
    },
    donate: {
      title: "Donar",
      text:
        "He recibido muchas solicitudes para donar a este proyecto, lo cual agradezco mucho. Escuchar las historias de éxito de las personas al encontrar vacunas es una recompensa suficiente, pero si deseas donar, considera las siguientes opciones:",
      options: [
        {
          title: "UNICEF",
          description:
            "Haz una donación a los esfuerzos de UNICEF para ayudar al lanzamiento mundial de la vacunación.",
        },
        {
          title: "DirectRelief",
          description:
            "Dona a los esfuerzos de DirectRelief para ayudar con la pandemia.",
        },
        {
          title: "Vaccine Spotter",
          description:
            "Si bien recomiendo donar directamente a otras organizaciones benéficas, si deseas apoyar a Vaccine Spotter, ¡gracias! <a href='https://givebutter.com/vaccinespotter' target='_blank' rel='noopener'>Aceptaré contribuciones</a> (<em> no </em> deducibles de impuestos) para cubrir los costos de alojamiento del sitio web. Las contribuciones excedentes las donaré a estas otras organizaciones benéficas.",
        },
      ],
    },
  },
};
