<template>
  <div class="w-full h-full flex flex-col justify-center items-center bg-teal/30 p-16 rounded-lg">
    <button class="absolute top-0 right-0 m-10" data-test="close-button" @click="close">
      <img class="h-6 w-6" src="@/assets/images/close.svg" alt="close" />
    </button>

    <button
      v-for="walletOption of walletOptions"
      :key="walletOption.name"
      class="w-[25rem] flex flex-col items-center my-5 py-5 bg-sea-green rounded-lg text-black gap-2"
      @click="walletOption.connect"
    >
      <img class="h-20 w-20" :src="walletOption.icon" :alt="walletOption.name + ' icon'" />
      <div class="text-2xl font-bold">{{ walletOption.name }}</div>
      <div class="text-lg">{{ walletOption.description }}</div>
    </button>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue';

import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';
import { isMobile } from '@/utils/userAgent';

const { provider, signer } = storeToRefs(useEthereumProvider());
const { rpcUrls } = storeToRefs(useConfiguration());
const { connectedWallet } = storeToRefs(useSettings());
const { connectMetaMask, connectWalletConnect } = useWallet(provider, connectedWallet, rpcUrls);

const walletOptions = ref([
  {
    name: 'MetaMask',
    icon: new URL('../assets/images/metamask.svg', import.meta.url).href,
    description: 'Connect using browser wallet',
    connect: () => connectMetaMask(true),
  },
  {
    name: 'WalletConnect',
    icon: new URL('../assets/images/walletconnect.svg', import.meta.url).href,
    description: 'Connect using mobile wallet',
    connect: connectWalletConnect,
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
