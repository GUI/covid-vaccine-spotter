export default {
  metadata: {
    title: "COVID-19 Vaccine Spotter",
    welcome: "Welcome",
    description:
      "A tool to help you track down COVID-19 vaccine appointment openings at your state's pharmacies. Updated every minute.",
    longDescription:
      "Rather than searching around on each pharmacy's website, we'll automatically scan the pharmacy websites and show you any available appointments we can find on one page.",
  },
  news: {
    date: "03/25/2021",
    message:
      "<strong>New features!</strong> 🌟 Filter by vaccine type (Moderna, Pfizer, J&J), appointment type (eg, if you only need a 2nd dose), and pharmacy. I know these have been frequently requested features, so I hope these help you in your vaccine quest!",
    suffix:
      "Any feedback is welcome: <a href='m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org'>vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a > or <a href='https://twitter.com/nickblah'>@nickblah</a>. And if you're a coder and have interest in helping out on <a href='https://github.com/GUI/covid-vaccine-finder/issues'>GitHub</a>, that would be dandy (although the code's still messy)!",
  },
  scanningDetails: {
    scanning:
      "Scanning {chain_count} pharmacy chains ({store_count} stores) in {state}",
  },
  searchBar: {
    zipTextField: {
      header: "Search for appointments near",
      placeholder: "Enter a 5 digit ZIP code",
    },
    radius: {
      header: "Within",
      anyDistance: "Any distance",
      xDistance: "{distance} miles",
    },
    filter: {
      appointmentType: {
        title: "Appointment type",
        options: ["All doses", "Second dose only"],
      },
      vaccineType: {
        title: "Vaccine type",
        options: ["All", "Johnson and Johnson", "Moderna", "Pfizer", "Unknown"],
      },
      pharmacy: {
        title: "Pharmacy",
        all: "All",
      },
    },
    withoutAppointments: "Show locations without current appointments",
    button: "Search",
    noResults:
      "No open appointments for your search can currently be found. Try expanding your search or check again later (appointments can come and go quickly).",
  },
  buttons: {
    newAppointments: "Check for New Appointments",
    visitWebsite: "Visit {name} Website",
  },
  share: {
    button: { on: "Share on {name}", by: "Share by {name}" },
    sites: {
      facebook: "Facebook",
      twitter: "Twitter",
      tumblr: "Tumblr",
      email: "E-Mail",
      pinterest: "Pinterest",
      linkedIn: "LinkedIn",
      reddit: "Reddit",
      whatsApp: "WhatsApp",
      hackerNews: "Hacker News",
    },
  },
  map: {
    legend: {
      available: "Appointments recently available",
      notAvailable: "Appointments not available",
      unknown: "Appointment status unknown",
    },
  },
  time: {
    unknown: "Unknown Time",
  },
  appointments: {
    available: "Appointments available as of {date_time}",
    viewDetails: "View Appointment Details",
    noneAvailable: "No appointments available as of last check",
    unknown: "Unknown Status",
    doesNotCarry:
      "At last check, this location does not carry the vaccine at all, so we have not fetched any appointments.",
    notCollected: "We haven't collected any data for this pharmacy yet.",
    oldData:
      '<strong>Uh oh!</strong> The data for this pharmacy is old. Please visit the <a href="{link}" target="_blank" rel="noopener">pharmacy\'s website</a> directly for appointment availability. this likely means that the pharmacy is blocking our tool from accessing their website.',
    visitWebsite: "Visit {name} Website",
    lastChecked: "Last Checked",
    never: "Never",
    viewOnWebsite: "View available appointment times on the {name} website.",
    moreAppointments: "View {count} other appointment times",
  },
  doses: {
    first: "First Dose",
    second: "Second Dose Only - {type}",
  },
  store: {
    miles: "miles",
    appointmentsAvailable: "Appointments available as of",
    krogerWarning:
      "Warning: Many users are reporting issues booking appointments with {name} (due to 2nd appointment requirements). However, some users have still reported success, so I still want to share the data I have from the pharmacies. I'm trying to figure out a better way to detect these issues, but in the meantime, sorry for any frustration!",
    educationStaff: "Education Staff and Childcare Providers Only",
    inPhiladelphia: "in Philadelphia",
    riteAid:
      'Rite Aid appointments are <a href="https://www.riteaid.com/corporate/news/-/pressreleases/news-room/2021/rite-aid-extends-covid-19-vaccine-priority-scheduling-period-for-teachers-school-staff-and-childcare-providers" target="_blank" rel="noopener"> only bookable by teachers, school staff and childcare providers</a> on Friday, March 19, Saturday, March 20, Friday, March 26, and Saturday, March 27<span v-show="store.properties.state === \'PA\'"> in Philadelphia (outside of Philadelphia other groups may still be eligible)</span>. Rite Aid appointments should re-open to other eligible groups again on other days.',
  },
  status: {
    title: "Tool Status",
    columnHeaders: ["Pharmacy", "Scanning", "Last Checked"],
    scanningCount: "{count} locations",
  },
  api: {
    title: "Very Beta API | COVID-19 Vaccine Spotter",
    description:
      "The machine readable data behind the COIVD-19 Vaccine Spotter tool. Very beta.",
    blockText:
      "Here's all of the underlying data in JSON format used for this tool. Things are moving fast, so this is subject to change. So while I'm hesitant to call this any type of stable API, I wanted to at least share what I have. If you do use this data just note that things may change. Feel free to reach out to let me know you're using this, so I can maybe give you a heads up about breaking changes:",
    or: "or",
    changelog: {
      beforeLink: "Subscribe to the",
      linkText: "API Changelog",
      afterLink:
        "discussion on GitHub for announcements on any API changes or additions.",
    },
  },
  contact: {
    github: "GitHub",
    twitterHandle: "@nickblah",
  },
  steps: [
    {
      header:
        "Step 1: Review your county's availability and {state}'s eligibility",
      colorado: `Visit <a href="https://covid19.colorado.gov/for-coloradans/vaccine/where-can-i-get-vaccinated" class="text-white"><strong class="fw-bold">Colorado.gov</strong></a > for detailed information about your county's vaccine options and review whether or not you are eligible yet.`,
      visitColorado: "Visit Colorado.gov",
      localProvider:
        "You may be able to signup for vaccines with a health care provider or there may be other options in your area, in which case you may not need this tool.",
      eligibility:
        "Be sure to visit your own state's official vaccination website for detailed information about your county's vaccine options and review whether or not you are eligible yet.",
    },
    {
      header: "Step 2: Use this tool to try and find a pharmacy appointment",
      text: [
        "If you decide you want to find an appointment at a local pharmacy (and are currently eligible for the vaccine), this tool might be able to help.",
        "Rather than searching around on each pharmacy's website, we'll automatically scan the pharmacy websites and show you any available appointments we can find on one page.",
        "All supported locations in {state_name} are scanned on a regular basis and this page is updated with any available appointments in the state. If you don't see locations near you right now, appointments can come and go quickly so try visiting the page at different times throughout the day.",
      ],
    },
  ],
  _state: {
    title: "{state} COVID-19 Vaccine Spotter",
    description: `A tool to help you track down COVID-19 vaccine appointment openings at {state} pharmacies. Updated every minute.`,
  },
  defaultVue: {
    forDevs: "For Developers:",
    api: "Very Beta API",
    github: "GitHub",

    about: {
      header: "About",
      text: [
        "Finding vaccines seems tough! Hopefully things will become easier soon, but in the meantime, maybe this can help. If you find this useful, feel free to share it around. Get in touch with any questions:",
        "I'd like to add additional functionality (scanning additional pharmacies and sending e-mail or text notifications when appointments open up) if this proves useful and as time permits. If you're a computer programmer and would like to contribute, the project is <a href=\"https://github.com/GUI/covid-vaccine-finder\"   >open source on GitHub</a > (it's currently very messy and undocumented, though).",
      ],
    },
  },
};
