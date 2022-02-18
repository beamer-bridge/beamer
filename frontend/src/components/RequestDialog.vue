<template>
  <div class="request-dialog">
    <div class="h-14">
      <div v-if="ethereumProvider.signer" class="flex flex-row gap-4 justify-center items-center">
        <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
        <span class="text-lg">You are currently connected via Metamask</span>
      </div>
    </div>
    <FormKit form-class="flex flex-col items-center" type="form" :actions="false">
      <Card class="self-stretch mb-11">
        <RequestFormInputs />

        <div v-if="transactionErrorMessage" class="">
          {{ transactionErrorMessage }}
        </div>
      </Card>
      <FormKit type="button">Connect MetaMask Wallet</FormKit>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import Card from '@/components/layout/Card.vue';
import useRequestTransaction from '@/composables/useRequestTransaction';
import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import { injectStrict } from '@/utils/vue-utils';

import RequestFormInputs from './RequestFormInputs.vue';

const ethereumProvider = injectStrict(EthereumProviderKey);
const raisyncConfig = injectStrict(RaisyncConfigKey);

const { transactionErrorMessage } = useRequestTransaction(ethereumProvider, raisyncConfig.value);
// TODO show block explorer URL on successful tx screen
</script>
