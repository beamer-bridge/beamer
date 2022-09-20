<template>
  <img class="w-[30rem] absolute top-12 left-12" src="@/assets/images/logo.svg" alt="logo" />
  <div v-if="configurationLoaded">
    <router-view v-if="!isBlacklistedWallet" class="z-10" />
    <div
      v-else
      class="text-red h-[90vh] w-full flex justify-center items-center text-4xl text-center px-4"
    >
      Your address is on the blocked list.
    </div>
  </div>
  <div v-else class="flex flex-grow items-center justify-center">
    <div class="w-48 h-48">
      <spinner size="48"></spinner>
    </div>
  </div>
  <feedback v-if="enableFeedback"></feedback>
  <footer class="my-8 text-lg text-center text-sea-green">
    Powered by Beamer &bull;
    <a href="https://beamerbridge.com/imprint.html" target="_blank" class="hover:underline"
      >Imprint</a
    >
  </footer>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Feedback from '@/components/Feedback.vue';
import Spinner from '@/components/Spinner.vue';
import { useContinueInterruptedTransfers } from '@/composables/useContinueInterruptedTransfers';
import useLoadConfiguration from '@/composables/useLoadConfiguration';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';

const enableFeedback = process.env.NODE_ENV === 'production' && true;

const configuration = useConfiguration();
const { configurationLoaded } = useLoadConfiguration(configuration.setChainConfiguration);

const { isBlacklistedWallet } = storeToRefs(useEthereumProvider());

const { transfers, loaded } = storeToRefs(useTransferHistory());
useContinueInterruptedTransfers(transfers as Ref<Array<Transfer>>, loaded);
</script>

<style lang="css">
#app {
  font-family: 'Sora', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: theme('colors.white');
  background: linear-gradient(180deg, theme('colors.black') 0%, theme('colors.teal') 100%);
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
