<template>
  <div
    class="app-content flex min-h-screen w-full flex-col bg-gradient-to-b from-black to-teal font-sans text-white antialiased"
  >
    <Banner></Banner>
    <div class="container mx-auto max-w-5xl">
      <a href="https://beamerbridge.com" target="_blank">
        <img class="mt-6 ml-6 w-[10rem] md:w-[15rem]" src="@/assets/images/logo.svg" alt="logo"
      /></a>
    </div>
    <div class="pt-2 md:pt-2">
      <div v-if="configurationLoaded">
        <router-view v-if="!isBlacklistedWallet" class="z-10" />
        <div
          v-else
          class="flex h-[90vh] w-full items-center justify-center px-4 text-center text-4xl text-red"
        >
          Your address is on the blocked list.
        </div>
      </div>
      <div
        v-else-if="configurationError"
        class="flex h-[90vh] w-full flex-col items-center justify-center px-4 text-center text-4xl text-red"
      >
        <span> Failed loading configuration. </span>
        <br />
        <span>
          If you see this error please report it on our
          <a href="https://discord.gg/beamerbridge" target="_blank" class="inline-block underline"
            >discord channel.</a
          >
        </span>
      </div>
      <div v-else class="flex flex-grow items-center justify-center">
        <div class="h-48 w-48">
          <spinner size-classes="w-48 h-48"></spinner>
        </div>
      </div>
    </div>
    <div class="flex-auto"></div>
    <Footer />
    <MatomoConsentPopup />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { onMounted } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Footer from '@/components/Footer.vue';
import Banner from '@/components/layout/Banner.vue';
import Spinner from '@/components/Spinner.vue';
import { useContinueInterruptedTransfers } from '@/composables/useContinueInterruptedTransfers';
import useLoadConfiguration from '@/composables/useLoadConfiguration';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { useTransferHistory } from '@/stores/transfer-history';

import MatomoConsentPopup from './components/MatomoConsentPopup.vue';
import { useClaimCountListeners } from './composables/useClaimCountListeners';
import { useTransferNotifications } from './composables/useTransferNotifications';

const { setConfiguration } = useConfiguration();
const { loadConfiguration, configurationLoaded, configurationError } =
  useLoadConfiguration(setConfiguration);

const { provider, isBlacklistedWallet } = storeToRefs(useEthereumWallet());

const { transfers, loaded: transferHistoryLoaded } = storeToRefs(useTransferHistory());
useTransferNotifications(transfers as Ref<Array<Transfer>>);
useContinueInterruptedTransfers(
  transfers as Ref<Array<Transfer>>,
  transferHistoryLoaded,
  provider,
);
useClaimCountListeners(transfers as Ref<Array<Transfer>>);

onMounted(loadConfiguration);
</script>
