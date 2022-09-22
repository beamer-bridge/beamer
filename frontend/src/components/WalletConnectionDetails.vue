<template>
  <div class="h-28 flex flex-col justify-center items-center">
    <ConnectionError v-slot="{ message }" data-test="error-component">
      <div class="text-center text-red p-2 text-lg h-12">
        {{ message }}
      </div>
    </ConnectionError>

    <div v-if="signer" class="flex flex-row gap-4 justify-center items-center" data-test="details">
      <div class="h-7 w-7 rounded-50 border-[3px] border-solid border-sea-green bg-green"></div>
      <div class="flex flex-col w-full">
        <span class="text-lg">You are currently connected</span>
        <Disconnect> </Disconnect>
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
