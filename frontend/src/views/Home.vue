<template>
  <div class="home flex justify-center">
    <div class="w-[40rem] flex flex-col xl:justify-center xl:items-center">
      <div class="text-center text-orange-dark p-2 text-lg h-12">
        {{ errorMessage }}
      </div>

      <div class="h-14">
        <div v-if="signer" class="flex flex-row gap-4 justify-center items-center">
          <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
          <span class="text-lg">You are currently connected</span>
        </div>
      </div>

      <Card class="relative bg-teal mb-11 w-full min-h-[50rem]">
        <WalletMenu v-if="walletMenuIsOpen" class="absolute z-10" @close="closeWalletMenu" />
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
import { computed, onMounted, ref } from 'vue';

import Card from '@/components/layout/Card.vue';
import Tabs from '@/components/layout/Tabs.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import TransferHistory from '@/components/TransferHistory.vue';
import WalletMenu from '@/components/WalletMenu.vue';
import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { signer } = storeToRefs(ethereumProvider);

const walletMenuIsOpen = ref(false);

function openWalletMenu(): void {
  walletMenuIsOpen.value = true;
}

function closeWalletMenu(): void {
  walletMenuIsOpen.value = false;
}

const tabs = [
  { label: 'Transfer', content: RequestDialog },
  { label: 'Activity', content: TransferHistory },
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

const { chainId } = storeToRefs(ethereumProvider);
const errorMessage = computed(() => {
  if (chainId.value > 0 && !configuration.isSupportedChain(chainId.value)) {
    return 'Connected chain is not supported';
  } else {
    return undefined;
  }
});

const { provider } = storeToRefs(ethereumProvider);
const { rpcUrls } = storeToRefs(configuration);
const { connectedWallet } = storeToRefs(useSettings());
const { reconnectToWallet } = useWallet(provider, connectedWallet, rpcUrls);

onMounted(reconnectToWallet);
</script>
