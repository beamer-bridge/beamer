<template>
  <div class="mb-5 mt-5 flex flex-col items-center justify-center">
    <ConnectionError />

    <div v-if="signer" class="flex flex-row items-center justify-center gap-2" data-test="details">
      <div class="h-4 w-4 rounded-50 border-[3px] border-solid border-sea-green bg-green"></div>
      <div class="flex w-full flex-col">
        <span class="text-xs">You are currently connected</span>
        <Disconnect />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { storeToRefs } from 'pinia';

import ConnectionError from '@/components/wallet/ConnectionError.vue';
import Disconnect from '@/components/wallet/Disconnect.vue';
import { useEthereumWallet } from '@/stores/ethereum-wallet';

const ethereumProvider = useEthereumWallet();
const { signer } = storeToRefs(ethereumProvider);
</script>
