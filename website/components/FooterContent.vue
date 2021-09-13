<template>
  <footer class="mt-3">
    <div class="container-lg">
      <h3 id="about">{{ $t("About") }}</h3>
      <!-- eslint-disable vue/no-v-html -->
      <p
        v-html="
          $t(
            'Finding vaccines seems tough! Hopefully things will become easier soon, but in the meantime, maybe this can help. If you find this useful, feel free to share it around. Get in touch with any questions: <a href=\u0022m&#97;ilto&#58;v%&#54;1&#99;&#99;&#105;ne&#64;nic&#107;%6D&#46;org\u0022>vacc&#105;ne&#64;ni&#99;k&#109;&#46;o&#114;&#103;</a>, <a href=\u0022https://twitter.com/nickblah\u0022>@nickblah</a>, or <a href=\u0022https://github.com/GUI/covid-vaccine-finder/issues\u0022>GitHub</a>.'
          )
        "
      />
      <p
        v-html="
          $t(
            'I\'d like to add additional functionality (scanning additional pharmacies and sending e-mail or text notifications when appointments open up) if this proves useful and as time permits. If you\'re a computer programmer and would like to contribute, the project is <a href=\u0022https://github.com/GUI/covid-vaccine-finder\u0022>open source on GitHub</a> (it\'s currently very messy and undocumented, though).'
          )
        "
      />
      <!-- eslint-enable vue/no-v-html -->

      <div class="text-center mb-3">
        <span style="display: inline-block; max-width: 620px">
          <!-- Sharingbutton Facebook -->
          <a
            class="resp-sharing-button__link"
            href="https://facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.vaccinespotter.org"
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Facebook')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--facebook resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"
                  />
                </svg>
              </div>
              {{ $t("Share on Facebook") }}
            </div>
          </a>

          <!-- Sharingbutton Twitter -->
          <a
            class="resp-sharing-button__link"
            href="https://twitter.com/intent/tweet/?text=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%USA%20pharmacies.%20Updated%20every%20minute.&amp;url=https%3A%2F%2Fwww.vaccinespotter.org"
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Twitter')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--twitter resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M23.44 4.83c-.8.37-1.5.38-2.22.02.93-.56.98-.96 1.32-2.02-.88.52-1.86.9-2.9 1.1-.82-.88-2-1.43-3.3-1.43-2.5 0-4.55 2.04-4.55 4.54 0 .36.03.7.1 1.04-3.77-.2-7.12-2-9.36-4.75-.4.67-.6 1.45-.6 2.3 0 1.56.8 2.95 2 3.77-.74-.03-1.44-.23-2.05-.57v.06c0 2.2 1.56 4.03 3.64 4.44-.67.2-1.37.2-2.06.08.58 1.8 2.26 3.12 4.25 3.16C5.78 18.1 3.37 18.74 1 18.46c2 1.3 4.4 2.04 6.97 2.04 8.35 0 12.92-6.92 12.92-12.93 0-.2 0-.4-.02-.6.9-.63 1.96-1.22 2.56-2.14z"
                  />
                </svg>
              </div>
              {{ $t("Share on Twitter") }}
            </div>
          </a>

          <!-- Sharingbutton Tumblr -->
          <a
            class="resp-sharing-button__link"
            href="https://www.tumblr.com/widgets/share/tool?posttype=link&amp;title=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.&amp;caption=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.&amp;content=https%3A%2F%2Fwww.vaccinespotter.org&amp;canonicalUrl=https%3A%2F%2Fwww.vaccinespotter.org&amp;shareSource=tumblr_share_button"
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Tumblr')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--tumblr resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M13.5.5v5h5v4h-5V15c0 5 3.5 4.4 6 2.8v4.4c-6.7 3.2-12 0-12-4.2V9.5h-3V6.7c1-.3 2.2-.7 3-1.3.5-.5 1-1.2 1.4-2 .3-.7.6-1.7.7-3h3.8z"
                  />
                </svg>
              </div>
              {{ $t("Share on Tumblr") }}
            </div>
          </a>

          <!-- Sharingbutton E-Mail -->
          <a
            class="resp-sharing-button__link"
            href="mailto:?subject=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.&amp;body=https%3A%2F%2Fwww.vaccinespotter.org"
            target="_self"
            rel="noopener"
            :aria-label="$t('Share by E-mail')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--email resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M22 4H2C.9 4 0 4.9 0 6v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7.25 14.43l-3.5 2c-.08.05-.17.07-.25.07-.17 0-.34-.1-.43-.25-.14-.24-.06-.55.18-.68l3.5-2c.24-.14.55-.06.68.18.14.24.06.55-.18.68zm4.75.07c-.1 0-.2-.03-.27-.08l-8.5-5.5c-.23-.15-.3-.46-.15-.7.15-.22.46-.3.7-.14L12 13.4l8.23-5.32c.23-.15.54-.08.7.15.14.23.07.54-.16.7l-8.5 5.5c-.08.04-.17.07-.27.07zm8.93 1.75c-.1.16-.26.25-.43.25-.08 0-.17-.02-.25-.07l-3.5-2c-.24-.13-.32-.44-.18-.68s.44-.32.68-.18l3.5 2c.24.13.32.44.18.68z"
                  />
                </svg>
              </div>
              {{ $t("Share by E-mail") }}
            </div>
          </a>

          <!-- Sharingbutton Pinterest -->
          <a
            class="resp-sharing-button__link"
            href="https://pinterest.com/pin/create/button/?url=https%3A%2F%2Fwww.vaccinespotter.org&amp;media=https%3A%2F%2Fwww.vaccinespotter.org&amp;description=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute."
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Pinterest')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--pinterest resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.14.5C5.86.5 2.7 5 2.7 8.75c0 2.27.86 4.3 2.7 5.05.3.12.57 0 .66-.33l.27-1.06c.1-.32.06-.44-.2-.73-.52-.62-.86-1.44-.86-2.6 0-3.33 2.5-6.32 6.5-6.32 3.55 0 5.5 2.17 5.5 5.07 0 3.8-1.7 7.02-4.2 7.02-1.37 0-2.4-1.14-2.07-2.54.4-1.68 1.16-3.48 1.16-4.7 0-1.07-.58-1.98-1.78-1.98-1.4 0-2.55 1.47-2.55 3.42 0 1.25.43 2.1.43 2.1l-1.7 7.2c-.5 2.13-.08 4.75-.04 5 .02.17.22.2.3.1.14-.18 1.82-2.26 2.4-4.33.16-.58.93-3.63.93-3.63.45.88 1.8 1.65 3.22 1.65 4.25 0 7.13-3.87 7.13-9.05C20.5 4.15 17.18.5 12.14.5z"
                  />
                </svg>
              </div>
              {{ $t("Share on Pinterest") }}
            </div>
          </a>

          <!-- Sharingbutton LinkedIn -->
          <a
            class="resp-sharing-button__link"
            href="https://www.linkedin.com/shareArticle?mini=true&amp;url=https%3A%2F%2Fwww.vaccinespotter.org&amp;title=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.&amp;summary=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.&amp;source=https%3A%2F%2Fwww.vaccinespotter.org"
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on LinkedIn')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--linkedin resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M6.5 21.5h-5v-13h5v13zM4 6.5C2.5 6.5 1.5 5.3 1.5 4s1-2.4 2.5-2.4c1.6 0 2.5 1 2.6 2.5 0 1.4-1 2.5-2.6 2.5zm11.5 6c-1 0-2 1-2 2v7h-5v-13h5V10s1.6-1.5 4-1.5c3 0 5 2.2 5 6.3v6.7h-5v-7c0-1-1-2-2-2z"
                  />
                </svg>
              </div>
              {{ $t("Share on LinkedIn") }}
            </div>
          </a>

          <!-- Sharingbutton Reddit -->
          <a
            class="resp-sharing-button__link"
            href="https://reddit.com/submit/?url=https%3A%2F%2Fwww.vaccinespotter.org&amp;resubmit=true&amp;title=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute."
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Reddit')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--reddit resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.75-1.64-6.07-1.72.08-1.1.4-3.05 1.52-3.7.72-.4 1.73-.24 3 .5C17.2 6.3 18.46 7.5 20 7.5c1.65 0 3-1.35 3-3s-1.35-3-3-3c-1.38 0-2.54.94-2.88 2.22-1.43-.72-2.64-.8-3.6-.25-1.64.94-1.95 3.47-2 4.55-2.33.08-4.45.7-6.1 1.72C4.86 8.98 3.96 8.5 3 8.5c-1.65 0-3 1.35-3 3 0 1.32.84 2.44 2.05 2.84-.03.22-.05.44-.05.66 0 3.86 4.5 7 10 7s10-3.14 10-7c0-.22-.02-.44-.05-.66 1.2-.4 2.05-1.54 2.05-2.84zM2.3 13.37C1.5 13.07 1 12.35 1 11.5c0-1.1.9-2 2-2 .64 0 1.22.32 1.6.82-1.1.85-1.92 1.9-2.3 3.05zm3.7.13c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9.8 4.8c-1.08.63-2.42.96-3.8.96-1.4 0-2.74-.34-3.8-.95-.24-.13-.32-.44-.2-.68.15-.24.46-.32.7-.18 1.83 1.06 4.76 1.06 6.6 0 .23-.13.53-.05.67.2.14.23.06.54-.18.67zm.2-2.8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm5.7-2.13c-.38-1.16-1.2-2.2-2.3-3.05.38-.5.97-.82 1.6-.82 1.1 0 2 .9 2 2 0 .84-.53 1.57-1.3 1.87z"
                  />
                </svg>
              </div>
              {{ $t("Share on Reddit") }}
            </div>
          </a>

          <!-- Sharingbutton WhatsApp -->
          <a
            class="resp-sharing-button__link"
            href="whatsapp://send?text=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute.%20https%3A%2F%2Fwww.vaccinespotter.org"
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on WhatsApp')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--whatsapp resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M20.1 3.9C17.9 1.7 15 .5 12 .5 5.8.5.7 5.6.7 11.9c0 2 .5 3.9 1.5 5.6L.6 23.4l6-1.6c1.6.9 3.5 1.3 5.4 1.3 6.3 0 11.4-5.1 11.4-11.4-.1-2.8-1.2-5.7-3.3-7.8zM12 21.4c-1.7 0-3.3-.5-4.8-1.3l-.4-.2-3.5 1 1-3.4L4 17c-1-1.5-1.4-3.2-1.4-5.1 0-5.2 4.2-9.4 9.4-9.4 2.5 0 4.9 1 6.7 2.8 1.8 1.8 2.8 4.2 2.8 6.7-.1 5.2-4.3 9.4-9.5 9.4zm5.1-7.1c-.3-.1-1.7-.9-1.9-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1s-1.2-.5-2.3-1.4c-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6s.3-.3.4-.5c.2-.1.3-.3.4-.5.1-.2 0-.4 0-.5C10 9 9.3 7.6 9 7c-.1-.4-.4-.3-.5-.3h-.6s-.4.1-.7.3c-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.3-.3-.4-.6-.5z"
                  />
                </svg>
              </div>
              {{ $t("Share on WhatsApp") }}
            </div>
          </a>

          <!-- Sharingbutton Hacker News -->
          <a
            class="resp-sharing-button__link"
            href="https://news.ycombinator.com/submitlink?u=https%3A%2F%2Fwww.vaccinespotter.org&amp;t=COVID-19%20Vaccine%20Spotter.%20A%20tool%20to%20help%20you%20track%20down%20COVID-19%20vaccine%20appointment%20openings%20at%20USA%20pharmacies.%20Updated%20every%20minute."
            target="_blank"
            rel="noopener"
            :aria-label="$t('Share on Hacker News')"
          >
            <div
              class="resp-sharing-button resp-sharing-button--hackernews resp-sharing-button--large"
            >
              <div
                aria-hidden="true"
                class="resp-sharing-button__icon resp-sharing-button__icon--solid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
                  <path
                    fill-rule="evenodd"
                    d="M60.94 82.314L17 0h20.08l25.85 52.093c.397.927.86 1.888 1.39 2.883.53.994.995 2.02 1.393 3.08.265.4.463.764.596 1.095.13.334.262.63.395.898.662 1.325 1.26 2.618 1.79 3.877.53 1.26.993 2.42 1.39 3.48 1.06-2.254 2.22-4.673 3.48-7.258 1.26-2.585 2.552-5.27 3.877-8.052L103.49 0h18.69L77.84 83.308v53.087h-16.9v-54.08z"
                  ></path>
                </svg>
              </div>
              {{ $t("Share on Hacker News") }}
            </div>
          </a>
        </span>
      </div>

      <p class="text-center mx-3">
        <a href="https://localazy.com/p/vaccinespotter" rel="noopener">{{
          $t("Help translate this website")
        }}</a>
        |
        {{ $t("For Developers:") }}
        <a :href="localePath('/api')">{{ $t("Very Beta API") }}</a> |
        <a href="https://github.com/GUI/covid-vaccine-finder">{{
          $t("GitHub")
        }}</a>
      </p>
    </div>
  </footer>
</template>

<script>
export default {};
</script>

<style></style>
