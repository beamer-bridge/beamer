<template>
  <div
    class="w-full h-full flex flex-col justify-center items-center bg-teal/30 p-16 rounded-lg"
    @click="close"
  >
    <button class="absolute top-0 right-0 m-5" data-test="close-button" @click="close">
      <img class="h-4 w-4" src="@/assets/images/close.svg" alt="close" />
    </button>

    <button
      v-for="walletOption of walletOptions"
      :key="walletOption.name"
      class="w-[22rem] sm:w-[25rem] md:w-[27rem] lg:w-[27rem] flex flex-col items-center my-5 py-5 bg-sea-green rounded-lg text-black gap-2"
      :data-test="`connect-${walletOption.name}`"
      @click.stop="walletOption.connect"
    >
      <div v-if="walletOption.connecting" class="w-15 h-15 items-center justify-center flex">
        <spinner class="border-t-teal border-4 h-1/2 w-1/2"></spinner>
      </div>
      <img v-else class="h-15 w-15" :src="walletOption.icon" :alt="walletOption.name + ' icon'" />
      <div class="text-xl font-bold">{{ walletOption.name }}</div>
      <div>{{ walletOption.description }}</div>
    </button>
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
const { connectMetaMask, connectWalletConnect, connectingMetaMask, connectingWalletConnect } =
  useWallet(provider, connectedWallet, rpcUrls);

const walletOptions = ref([
  {
    name: 'MetaMask',
    icon: new URL('../assets/images/metamask.svg', import.meta.url).href,
    description: 'Connect using browser wallet',
    connect: () => connectMetaMask(true),
    connecting: connectingMetaMask,
  },
  {
    name: 'WalletConnect',
    icon: new URL('../assets/images/walletconnect.svg', import.meta.url).href,
    description: 'Connect using mobile wallet',
    connect: connectWalletConnect,
    connecting: connectingWalletConnect,
  },
]);

onMounted(() => {
  // Use stripped down option list for mobile devices
  if (isMobile(window.navigator.userAgent)) {
    const metaMaskAvailable = window.ethereum && window.ethereum.isMetaMask;

    if (metaMaskAvailable) {
      walletOptions.value = walletOptions.value.filter((option) => option.name === 'MetaMask');
    } else {
      walletOptions.value = walletOptions.value.filter(
        (option) => option.name === 'WalletConnect',
      );
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
