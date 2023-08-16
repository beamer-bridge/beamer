<template>
  <div v-if="message && message.length > 0" class="pb-3 text-center text-sm text-red">
    {{ message }}
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';

const ethereumProvider = useEthereumWallet();
const configuration = useConfiguration();
const { chainId } = storeToRefs(ethereumProvider);

const message = computed(() => {
  if (chainId.value > 0 && !configuration.isSupportedChain(chainId.value)) {
    return 'Connected chain is not supported';
  } else {
    return undefined;
  }
});
</script>
