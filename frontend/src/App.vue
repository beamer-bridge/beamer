<template>
  <div class="app-content">
    <div class="container mx-auto max-w-5xl">
      <a href="https://beamerbridge.com" target="_blank">
        <img class="w-[10rem] md:w-[15rem] mt-6 ml-6" src="@/assets/images/logo.svg" alt="logo"
      /></a>
    </div>
    <div class="pt-2 md:pt-2">
      <div v-if="configurationLoaded">
        <router-view v-if="!isBlacklistedWallet" class="z-10" />
        <div
          v-else
          class="text-red h-[90vh] w-full flex justify-center items-center text-4xl text-center px-4"
        >
          Your address is on the blocked list.
        </div>
      </div>
      <div
        v-else-if="configurationError"
        class="text-red h-[90vh] w-full flex flex-col justify-center items-center text-4xl text-center px-4"
      >
        <span> Failed loading configuration. </span>
        <br />
        <span>
          If you see this error please report it on our
          <a
            href="https://discord.com/invite/YWdStZkz9z"
            target="_blank"
            class="underline inline-block"
            >discord channel.</a
          >
        </span>
      </div>
      <div v-else class="flex flex-grow items-center justify-center">
        <div class="w-48 h-48">
          <spinner size-classes="w-48 h-48"></spinner>
        </div>
      </div>
      <feedback v-if="enableFeedback"></feedback>
      <footer class="my-8 text-lg text-center text-sea-green">
        Powered by
        <a href="https://beamerbridge.com" target="_blank" class="hover:underline">Beamer</a>
        &bull;
        <a href="https://beamerbridge.com/imprint.html" target="_blank" class="hover:underline"
          >Imprint</a
        >
        &bull;
        <a href="https://beamerbridge.com/terms.html" target="_blank" class="hover:underline"
          >Terms of Service</a
        >
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { onMounted } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Feedback from '@/components/Feedback.vue';
import Spinner from '@/components/Spinner.vue';
import { useContinueInterruptedTransfers } from '@/composables/useContinueInterruptedTransfers';
import useLoadConfiguration from '@/composables/useLoadConfiguration';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';

import { useClaimCountListeners } from './composables/useClaimCountListeners';

const enableFeedback = process.env.NODE_ENV === 'production' && true;

const { setConfiguration } = useConfiguration();
const { loadConfiguration, configurationLoaded, configurationError } =
  useLoadConfiguration(setConfiguration);

const { isBlacklistedWallet } = storeToRefs(useEthereumProvider());

const { transfers, loaded } = storeToRefs(useTransferHistory());
useContinueInterruptedTransfers(transfers as Ref<Array<Transfer>>, loaded);
useClaimCountListeners(transfers as Ref<Array<Transfer>>);

onMounted(loadConfiguration);
</script>

<style lang="css">
.app-content {
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
