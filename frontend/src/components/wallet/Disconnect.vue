<template>
  <button class="inline underline w-fit" data-test="trigger" @click="disconnect">
    Disconnect Wallet
  </button>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { ref } from 'vue';

import { useWallet } from '@/composables/useWallet';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';

const ethereumProvider = useEthereumProvider();
const { provider } = storeToRefs(ethereumProvider);
const { connectedWallet } = storeToRefs(useSettings());

const { disconnectWallet: disconnect } = useWallet(provider, connectedWallet, ref());
</script>
