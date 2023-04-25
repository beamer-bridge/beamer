<template>
  <button
    v-if="!disconnectInProgress"
    class="inline underline w-fit text-xs"
    data-test="trigger"
    @click="disconnect"
  >
    Disconnect Wallet
  </button>
  <spinner v-else class="border-t-sea-green" size-classes="w-4 h-4" border="2"></spinner>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { ref } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { useWallet } from '@/composables/useWallet';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';

const ethereumProvider = useEthereumProvider();
const { provider } = storeToRefs(ethereumProvider);
const { connectedWallet } = storeToRefs(useSettings());

const { disconnectWallet: disconnect, disconnectInProgress } = useWallet(
  provider,
  connectedWallet,
  ref({}),
);
</script>
