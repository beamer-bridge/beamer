<template>
  <div
    v-if="displayed"
    class="fixed w-full h-full flex justify-center items-center z-50 backdrop-blur"
    data-test="consent-popup"
  >
    <div class="max-w-lg py-6 px-6 bg-teal-dark rounded-md">
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
      <div class="flex flex-row justify-evenly mt-6">
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
import { ref } from 'vue';

import SimpleTextButton from './layout/SimpleTextButton.vue';

const _paq = (window._paq = window._paq || []);

const displayed = ref(false);

_paq.push([
  function () {
    const rememberedConsent = this.getRememberedConsent();
    displayed.value = !rememberedConsent;
  },
]);

const allowConsent = () => {
  _paq.push(['rememberConsentGiven']);
  displayed.value = false;
};

const disallowConsent = () => {
  displayed.value = false;
};
</script>
