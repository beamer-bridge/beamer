<template>
  <div class="flex flex-col justify-center items-center mb-5 mt-5">
    <ConnectionError />

    <div v-if="signer" class="flex flex-row gap-2 justify-center items-center" data-test="details">
      <div class="h-4 w-4 rounded-50 border-[3px] border-solid border-sea-green bg-green"></div>
      <div class="flex flex-col w-full">
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
import { useEthereumProvider } from '@/stores/ethereum-provider';

const ethereumProvider = useEthereumProvider();
const { signer } = storeToRefs(ethereumProvider);
</script>
