<template>
  <div
    v-if="displayed"
    class="fixed z-50 flex h-full w-full items-center justify-center backdrop-blur"
    data-test="consent-popup"
  >
    <div class="max-w-lg rounded-md bg-teal-dark py-6 px-6">
      This site uses Matomo to analyze traffic and help us to improve your user experience. We
      process your IP address and cookies are stored on your browser for 13 months. This data is
      only processed by us and our web hosting platform. Please read our
      <a
        href="https://beamerbridge.com/privacy.html"
        target="_blank"
        class="text-sea-green hover:underline"
        >Privacy Policy</a
      >
      to learn more.
      <div class="mt-6 flex flex-row justify-evenly">
        <SimpleTextButton class="!text-base" data-test="accept-consent" @click="allowConsent"
          >Accept</SimpleTextButton
        >
        <SimpleTextButton class="!text-base" data-test="decline-consent" @click="disallowConsent"
          >Decline</SimpleTextButton
        >
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { ref } from 'vue';

import SimpleTextButton from '@/components/layout/SimpleTextButton.vue';
import { useSettings } from '@/stores/settings';

const _paq = (window._paq = window._paq || []);

const { matomoConsentDeclined } = storeToRefs(useSettings());

const displayed = ref(false);

_paq.push([
  function () {
    const rememberedConsent = this.getRememberedConsent();
    displayed.value = !rememberedConsent && !matomoConsentDeclined.value;
  },
]);

const allowConsent = () => {
  _paq.push(['rememberConsentGiven']);
  displayed.value = false;
};

const disallowConsent = () => {
  matomoConsentDeclined.value = true;
  displayed.value = false;
};
</script>
