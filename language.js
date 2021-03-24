export default {
  locales: ["en", "fr", "es"],
  defaultLocale: "en",
  vueI18n: {
    fallbackLocale: "en",
    messages: {
      en: {
        metadata: {
          title: "COVID-19 Vaccine Spotter",
          welcome: "Welcome",
          description:
            "A tool to help you track down COVID-19 vaccine appointment openings at your state's pharmacies. Updated every minute.",
          longDescription:
            "Rather than searching around on each pharmacy's website, we'll automatically scan the pharmacy websites and show you any available appointments we can find on one page.",
        },
        news: {
          date: "03/23/2021",
          message:
            "Once again <strong>Walgreens</strong> has started blocking access, but I'm hoping the latest workarounds should restore Walgreens appointment availability (again). In the meantime, I have also added <strong>Centura Health</strong> appointments for Colorado users.",
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
          withoutAppointments: "Show locations without current appointments",
          button: "Search",
        },
        buttons: {
          newAppointments: "Check for New Appointments",
          visitWebsite: "Visit {name} Website",
        },
        share: {
          button: "Share on {name}",
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
        about: {
          header: "About",
          description: "",
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
            '<strong>Uh oh!</strong> The data for this pharmacy is old. Please visit the <a href="{link} target="_blank" rel="noopener">pharmacy\'s website</a> directly for appointment availability. this likely means that the pharmacy is blocking our tool from accessing their website.',
          visitWebsite: "Visit {name} Website",
          lastChecked: "Last Checked",
          never: "never",
        },
        appointmentTimes: {
          viewOnWebsite:
            "View available appointment times on the {name} website.",
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
          header: 'Tool Status'
        }
      },
      es: {
        welcome: "Bienvenido",
        title: "COVID-19 Vaccine Spotter",
      },
    },
  },
};
