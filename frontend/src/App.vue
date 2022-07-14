<template>
  <img class="w-[30rem] absolute top-12 left-12" src="@/assets/images/logo.svg" alt="logo" />
  <router-view v-if="configurationLoaded" class="flex-auto z-10" />
  <div v-else class="flex-auto flex flex-col items-center justify-center">
    <div class="w-48 h-48">
      <spinner></spinner>
    </div>
  </div>
  <feedback v-if="enableFeedback"></feedback>
  <footer class="my-8 text-lg text-center text-teal-light">
    Powered by Beamer &bull;
    <imprint-modal />
  </footer>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Feedback from '@/components/Feedback.vue';
import ImprintModal from '@/components/ImprintModal.vue';
import Spinner from '@/components/Spinner.vue';
import { useContinueInterruptedTransfers } from '@/composables/useContinueInterruptedTransfers';
import useLoadConfiguration from '@/composables/useLoadConfiguration';
import { useConfiguration } from '@/stores/configuration';
import { useTransferHistory } from '@/stores/transfer-history';

const enableFeedback = false;

const configuration = useConfiguration();
const { configurationLoaded } = useLoadConfiguration(configuration.setChainConfiguration);

const { transfers, loaded } = storeToRefs(useTransferHistory());
useContinueInterruptedTransfers(transfers as Ref<Array<Transfer>>, loaded);
</script>

<style lang="css">
#app {
  font-family: 'Sora', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: theme('colors.light');
  background: linear-gradient(
    180deg,
    theme('colors.teal-very-dark') 0%,
    theme('colors.teal') 100%
  );
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
