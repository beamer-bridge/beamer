<template>
  <div
    class="w-full h-full flex flex-col justify-center items-center bg-teal/30 p-5 rounded-lg"
    @click="close"
  >
    <div class="flex w-full mb-5 pl-6">
      <div class="flex-1 justify-between items-stretch font-bold">Connect wallet</div>

      <button class="mr-6" data-test="close-button" @click="close">
        <img class="h-4 w-4" src="@/assets/images/close.svg" alt="close" />
      </button>
    </div>

    <div>
      <button
        v-for="walletOption of walletOptions"
        :key="walletOption.name"
        class="w-full mb-5 py-1 px-3 bg-sea-green rounded-lg text-black gap-2"
        :data-test="`connect-${walletOption.name}`"
        @click.stop="walletOption.connect"
      >
        <div class="flex items-center">
          <div v-if="walletOption.connecting" class="w-16 h-16 items-center justify-center flex">
            <spinner class="border-t-teal border-4 h-1/2 w-1/2"></spinner>
          </div>
          <img
            v-else
            class="w-16 h-16"
            :class="walletOption.classes"
            :src="walletOption.icon"
            :alt="walletOption.name + ' icon'"
          />
          <div class="flex-col">
            <div class="font-bold text-left">{{ walletOption.name }}</div>
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
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';
import { isMobile } from '@/utils/userAgent';

const { provider, signer } = storeToRefs(useEthereumProvider());
const { rpcUrls } = storeToRefs(useConfiguration());
const { connectedWallet } = storeToRefs(useSettings());
const {
  connectMetaMask,
  connectWalletConnect,
  connectingMetaMask,
  connectingWalletConnect,
  connectCoinbase,
  connectingCoinbase,
} = useWallet(provider, connectedWallet, rpcUrls);

const walletOptions = ref([
  {
    name: 'MetaMask',
    icon: new URL('../assets/images/metamask.svg', import.meta.url).href,
    description: 'Connect using browser wallet',
    connect: () => connectMetaMask(true),
    connecting: connectingMetaMask,
    hasMobileFlow: false,
  },
  {
    name: 'WalletConnect',
    icon: new URL('../assets/images/walletconnect.svg', import.meta.url).href,
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
  if (isMobile(window.navigator.userAgent)) {
    const metaMaskAvailable = window.ethereum && window.ethereum.isMetaMask;
    const coinbaseAvailable = window.ethereum && window.ethereum.isCoinbaseWallet;

    if (metaMaskAvailable) {
      walletOptions.value = walletOptions.value.filter((option) => option.name === 'MetaMask');
    } else if (coinbaseAvailable) {
      walletOptions.value = walletOptions.value.filter((option) => option.name === 'Coinbase');
    } else {
      walletOptions.value = walletOptions.value.filter((option) => option.hasMobileFlow);
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
