<template>
  <div class="home flex justify-center">
    <div class="w-[40rem] flex flex-col xl:justify-center xl:items-center">
      <div class="text-center text-orange-dark p-2 text-lg h-12">
        <div v-if="errorMessage">
          {{ errorMessage }}
        </div>
      </div>
      <div class="h-14">
        <div v-if="signer" class="flex flex-row gap-4 justify-center items-center">
          <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
          <span class="text-lg">You are currently connected</span>
        </div>
      </div>

      <Card class="relative bg-teal mb-11 w-full min-h-[50rem]">
        <WalletMenu v-if="walletMenuIsOpen" class="absolute z-30" @close="closeWalletMenu()" />
        <Tabs :tabs="tabs" :class="tabsClasses" />
      </Card>

      <div id="action-button-portal" class="flex justify-center h-28">
        <FormKit
          v-if="!signer && !walletMenuIsOpen"
          input-class="bg-orange flex flex-row justify-center"
          type="button"
          @click="openWalletMenu"
          >Connect to Wallet
        </FormKit>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import Tabs from '@/components/layout/Tabs.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import WalletMenu from '@/components/WalletMenu.vue';
import { useRequestSigner } from '@/composables/useRequestSigner';
import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';

const ethereumProvider = useEthereumProvider();
const configuration = useConfiguration();
const settings = useSettings();
const { connectedWallet } = storeToRefs(settings);

const criticalErrorMessage = ref('');
const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const { run: requestSigner, error: requestSignerError } = useRequestSigner();

const { getConnectedWalletProvider } = useWallet(
  provider,
  connectedWallet,
  configuration.rpcUrls,
  requestSigner,
);

const walletMenuIsOpen = ref(false);

const openWalletMenu = () => {
  walletMenuIsOpen.value = true;
};

const closeWalletMenu = () => {
  walletMenuIsOpen.value = false;
};

const tabs = [
  {
    label: 'Transfer',
    content: RequestDialog,
  },
  {
    label: 'Activity',
    content: null,
  },
];

/*
 * Please note that we must apply the blur effect on the background element,
 * because the backdrop blur property is not yet fully supported by all
 * web-browsers. As this UI doesn't work without the effect, we need to ensure it
 * always works. This is the current workaround in contrast to having a blurred
 * backdrop on the WalletMenu component itself.
 */
const tabsClasses = computed(() => ({
  'blur-xl': walletMenuIsOpen.value,
}));

const isSupportedChain = computed(() => configuration.isSupportedChain(ethereumProvider.chainId));

const chainChangeHandler = () => {
  criticalErrorMessage.value = isSupportedChain.value ? '' : 'Connected chain is not supported!';
};

const errorMessage = computed(() => {
  return criticalErrorMessage.value || requestSignerError.value;
});

watch(chainId, chainChangeHandler);

onMounted(async () => {
  provider.value = await getConnectedWalletProvider();
});
</script>
