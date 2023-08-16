<template>
  <div
    class="flex h-full w-full flex-col items-center justify-center rounded-lg bg-teal/30 p-5"
    @click="close"
  >
    <div class="mb-5 flex w-full pl-6">
      <div class="flex-1 items-stretch justify-between font-bold">Connect wallet</div>

      <button class="mr-6" data-test="close-button" @click="close">
        <img class="h-4 w-4" src="@/assets/images/close.svg" alt="close" />
      </button>
    </div>

    <div>
      <button
        v-for="walletOption of walletOptions"
        :key="walletOption.name"
        class="mb-5 w-full gap-2 rounded-lg bg-sea-green py-1 px-3 text-black"
        :data-test="`connect-${walletOption.name}`"
        @click.stop="walletOption.connect"
      >
        <div class="flex items-center">
          <div v-if="walletOption.connecting" class="flex h-16 w-16 items-center justify-center">
            <spinner class="h-1/2 w-1/2 border-4 border-t-teal"></spinner>
          </div>
          <img
            v-else
            class="h-16 w-16"
            :class="walletOption.classes"
            :src="walletOption.icon"
            :alt="walletOption.name + ' icon'"
          />
          <div class="flex-col">
            <div class="text-left font-bold">{{ walletOption.name }}</div>
            <div class="text-sm">{{ walletOption.description }}</div>
          </div>
        </div>
      </button>
    </div>

    <div class="px-6">
      By connecting a wallet, you agree to the
      <a
        href="https://beamerbridge.com/terms.html"
        target="_blank"
        class="underline hover:opacity-90"
        >terms of service</a
      >.
    </div>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { useSettings } from '@/stores/settings';
import { isMobile } from '@/utils/userAgent';

const { provider, signer } = storeToRefs(useEthereumWallet());
const { rpcUrls } = storeToRefs(useConfiguration());
const { connectedWallet } = storeToRefs(useSettings());
const {
  connectMetaMask,
  connectInjected,
  connectingInjected,
  connectWalletConnect,
  connectingMetaMask,
  connectingWalletConnect,
  connectCoinbase,
  connectingCoinbase,
} = useWallet(provider, connectedWallet, rpcUrls);

const walletOptions = ref([
  {
    name: 'Browser Wallet',
    icon: new URL('../assets/images/browser-wallet.svg', import.meta.url).href,
    description: 'Connect using browser wallet',
    classes: 'p-3',
    connect: connectInjected,
    connecting: connectingInjected,
    hasMobileFlow: false,
  },
  {
    name: 'MetaMask',
    icon: new URL('../assets/images/metamask.svg', import.meta.url).href,
    description: 'Connect using MetaMask',
    connect: () => connectMetaMask(true),
    connecting: connectingMetaMask,
    hasMobileFlow: false,
  },
  {
    name: 'WalletConnect',
    icon: new URL('../assets/images/walletconnect.svg', import.meta.url).href,
    classes: 'w-16 h-16',
    description: 'Connect using mobile wallet',
    connect: connectWalletConnect,
    connecting: connectingWalletConnect,
    hasMobileFlow: true,
  },
  {
    name: 'Coinbase',
    icon: new URL('../assets/images/coinbase_wallet.png', import.meta.url).href,
    classes: 'p-3',
    description: 'Connect using coinbase wallet',
    connect: connectCoinbase,
    connecting: connectingCoinbase,
    hasMobileFlow: true,
  },
]);

onMounted(() => {
  const injectionAvailable = window.ethereum;
  const metaMaskAvailable = injectionAvailable && window.ethereum.isMetaMask;
  const coinbaseAvailable = injectionAvailable && window.ethereum.isCoinbaseWallet;

  if (isMobile(window.navigator.userAgent)) {
    if (metaMaskAvailable) {
      walletOptions.value = walletOptions.value.filter((option) => option.name === 'MetaMask');
    } else if (coinbaseAvailable) {
      walletOptions.value = walletOptions.value.filter((option) => option.name === 'Coinbase');
    } else {
      walletOptions.value = walletOptions.value.filter((option) => option.hasMobileFlow);
    }
  } else {
    if (metaMaskAvailable || !injectionAvailable) {
      walletOptions.value = walletOptions.value.filter(
        (option) => option.name !== 'Browser Wallet',
      );
    } else {
      walletOptions.value = walletOptions.value.filter((option) => option.name !== 'MetaMask');
    }
  }
});

const emit = defineEmits<{
  (event: 'close'): void;
}>();

function close(): void {
  emit('close');
}

watch(signer, () => {
  if (signer.value) {
    close();
  }
});
</script>
