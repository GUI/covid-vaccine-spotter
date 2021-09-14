<template>
  <div>
    <social-head :title="title" :description="description" />

    <navbar :title="title" />

    <main class="container-lg my-3">
      <h1 class="h3">Vaccine Spotter Shutdown</h1>

      <p>
        Hello, world! I wanted to let you all know that Vaccine Spotter will be
        shutting down on September 23, 2021. Please visit
        <a href="https://www.vaccines.gov">Vaccines.gov</a> for vaccine
        availability. And if you're not already vaccinated, please consider
        getting vaccinated if you're able to. ❤️
      </p>

      <p>
        This shutdown is probably overdue, so apologies for any confusion this
        site has caused in recent months while I've not been actively
        maintaining it. I've just been procrastinating and lazy in figuring out
        these shutdown plans and announcing this.
      </p>

      <p>
        I realize COVID-19 is still unfortunately affecting a lot of people, but
        vaccine appointment availability does not seem like it's been the
        biggest barrier in the US for a little while now, so that's why it feels
        past due to wind this site down and point people to better maintained
        resources, like <a href="https://www.vaccines.gov">Vaccines.gov</a>.
      </p>

      <p>
        Vaccine Spotter's
        <a href="https://github.com/GUI/covid-vaccine-spotter"
          >open source code</a
        >
        will remain available if it's of any interest or use. A static version
        of the
        <a href="/api/">APIs and data downloads</a> will also remain available
        for some period of time if you're interested in historical analysis, but
        the data will not be updated after September 23 and I will eventually
        take these down as well.
      </p>

      <h2 class="h4">Statistics</h2>

      <p>
        Because I'm a nerd, I also wanted to share a bit of statistics on
        Vaccine Spotter's usage and growth as I wrap things up. It's hard to say
        how many people actually benefited from the site, but hopefully it
        helped a few people out!
      </p>

      <ul>
        <li>
          History: Started coding February 9; launched February 16 covering the
          Colorado area; expanded to US-wide on February 24; ended up scanning
          40,000+ pharmacy locations.
        </li>
        <li>
          Website Traffic:
          <ul>
            <li>5 million unique users.</li>
            <li>54 million page views.</li>
            <li>
              At its highest peak, on a single day (April 5): 300,000 unique
              users, 2 million page views, and 10,000 concurrent users viewing
              the site.
            </li>
          </ul>
        </li>
        <li>
          Raw Traffic: Because I also focused on openly sharing the underlying
          data I gathered via APIs for other programmers out there, I know other
          websites, applications, and bots were able to leverage the Vaccine
          Spotter data and expand its reach. I didn't specifically gather API
          analytics, but some of the raw traffic perhaps gives a sense of how
          the underlying data was used:
          <ul>
            <li>622 million requests served.</li>
            <li>13 million unique IP addresses served.</li>
            <li>36 TB of traffic served.</li>
          </ul>
        </li>
        <li>2,500 personal e-mails received.</li>
      </ul>

      <h2 class="h4">Donations</h2>

      <p>
        I also wanted to thank all of the individuals that contributed money to
        help offset my direct hosting costs and allow me to donate the rest to
        charity. For full transparency, I wanted to provide an update on how
        much I raised, my costs, and how much I was able to donate.
      </p>

      <ul>
        <li>$6,970 raised from 361 individuals.</li>
        <li>
          $1,492 used in direct server/hosting costs. This is higher than I
          would have liked, but I wasn't paying attention early on, so some
          costs definitely snuck up on me. I finally got things cleaned up and
          to a point where the costs for the past several months have been
          pretty minimal, but I really appreciate all the contributions so I
          didn't have to pay this out of pocket.
        </li>
        <li>
          $5,478 donated to charities (split evenly between
          <a href="https://www.unicefusa.org/mission/covid-19/vaccine"
            >UNICEF's</a
          >
          and
          <a href="https://www.directrelief.org/emergency/coronavirus-outbreak/"
            >Direct Relief's</a
          >
          COVID-19 efforts).
        </li>
      </ul>

      <h2 class="h4">Thank Yous</h2>

      <p>
        There are a multitude of people I should be thanking. I know I'll forget
        tons of people, but I'll at least try to thank some groups.
      </p>

      <ul>
        <li>
          First and foremost, thank you to all the health care workers that are
          saving people's lives, making these vaccines, administering them, and
          everyone else involved. Vaccine Spotter was only one very tiny piece
          of this large puzzle. I hope the website helped some people, but there
          are a lot of other people out there doing more important work with
          COVID-19.
        </li>
        <li>
          Thank you to everyone that helped share this tool. Without all of you,
          this tool wouldn't have had such and impact. On day 1—when I was
          clueless as to how to share my creation—Redditors, Governor Polis, and
          the local news all really helped get the word out, so thank you! From
          there, thank you to all of the news media (large and small) that
          picked it up and helped promote the tool, and thank you to every
          individual that shared it by word of mouth (I know there were a lot of
          you)!
        </li>
        <li>
          Thank you to my workplace and coworkers at the National Renewable
          Energy Laboratory (NREL) for being extremely supportive of these
          efforts. They helped come up with the idea, helped test it, provided
          feedback and ideas, and were hugely supportive and awesome when this
          project unexpectedly grew so quickly.
        </li>
        <li>
          Thank you to everyone in the "scraping" community. I was initially
          inspired by some similar efforts in other parts of the country, but
          after launching Vaccine Spotter, I stumbled into a fantastic community
          of other coders across the country working to solve these issues in a
          variety of ways. Thank all of you for your collaboration,
          selflessness, and dedication to helping people!
        </li>
        <li>
          Thank you to the open source community that contributed in ways large
          and small to the open source Vaccine Spotter code base. I know the
          code was messy, undocumented, and I wasn't always the best steward of
          the open source code, but thank you for your patience and
          contributions!
        </li>
        <li>
          Thank you to everyone in federal, state, and local governments that
          helped with the broader vaccination efforts in all sorts of ways. I
          know you all had a ton on your plate, so I'm glad the tool or data
          could be used by some of you. I also really appreciate the help and
          support the CDC, HHS, USDS, and other agencies offered in getting
          better access to data, and for your forward-thinking efforts to define
          standards to make this easier in the future.
        </li>
        <li>
          Thank you to all the volunteers of various organizations that helped
          people find appointments. I'm happy Vaccine Spotter could be a useful
          tool for you all (and stories of some of you using the tool to find
          hundreds of appointments kept me motivated), but you all were doing
          great work to actually help individuals get appointments that might
          have otherwise been struggling with the technology.
        </li>
        <li>
          Thank you to other developers out there that built other tools, bots,
          and apps using the Vaccine Spotter data, since that enabled us all to
          help more people.
        </li>
        <li>
          Thank you to a company (that wanted to remain anonymous) who helped
          cover the expenses of some more expensive proxy services that allowed
          for some workarounds in accessing some of the pharmacy websites.
          Thanks for your collaboration!
        </li>
        <li>
          Thank you to pharmacies for vaccinating everyone and your hard work on
          your own websites, which is what allowed tools like this to exist.
        </li>
        <li>
          Thank you to thousands of people that personally emailed me with
          success stories, feedback, ideas, bug reports, and nice things to say
          (or sometimes not nice things to say 🙂). I sadly wasn't able to
          respond to most of these, but I read them all, so thank you for making
          the website better and sharing words of encouragement.
        </li>
        <li>
          Thank you to my family for helping vote on the "Vaccine Spotter" name
          and to Beth for your support and dealing with the many, many long
          nights/mornings I spent obsessed with trying to improve the tool.
        </li>
        <li>Thank you to everyone who has gotten vaccinated!</li>
      </ul>

      <p>
        Building this website has been an unexpected adventure. I know the tool
        was far from perfect, but I just hope it sometimes helped people find
        appointments. From here, I just hope things continue to get better.
      </p>

      <p>❤️ Nick</p>
      <p>
        <a
          href="m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org"
          >vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a
        >
        | <a href="https://twitter.com/nickblah">@nickblah</a> |
        <a href="https://github.com/GUI/covid-vaccine-spotter">Code</a>
      </p>
    </main>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: `${this.$t("Shutdown")} | ${this.$t("Vaccine Spotter")}`,
      description: this.$t("Winding down operations of VaccineSpotter.org."),
    };
  },
};
</script>

<style></style>
