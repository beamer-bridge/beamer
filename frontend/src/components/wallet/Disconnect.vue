<template>
  <button
    v-if="showDisconnect"
    class="inline w-fit text-xs underline"
    data-test="trigger"
    @click="disconnect"
  >
    Disconnect Wallet
  </button>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import { useWallet } from '@/composables/useWallet';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { useSettings } from '@/stores/settings';

const ethereumProvider = useEthereumWallet();
const { provider } = storeToRefs(ethereumProvider);
const { connectedWallet } = storeToRefs(useSettings());

const showDisconnect = computed(() => !!provider.value?.disconnectable);
const { disconnectWallet: disconnect } = useWallet(provider, connectedWallet, ref());
</script>
