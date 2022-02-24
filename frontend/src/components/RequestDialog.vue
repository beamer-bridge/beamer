<template>
  <div class="request-dialog">
    <div class="h-14">
      <div
        v-if="ethereumProvider.signer.value"
        class="flex flex-row gap-4 justify-center items-center"
      >
        <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
        <span class="text-lg">You are currently connected via Metamask</span>
      </div>
    </div>
    <FormKit
      v-slot="{ state: { valid } }"
      form-class="flex flex-col items-center"
      type="form"
      :actions="false"
      @submit="submitRequestTransaction"
    >
      <Card class="bg-teal px-20 pt-18 pb-14 self-stretch mb-11">
        <RequestFormInputs v-if="!isProcessing" />
        <RequestProcessing  v-else />
        <Transition name="expand">
          <div v-if="shownError()" class="mt-7 text-right text-lg text-orange-dark">
            {{ shownError() }}
          </div>
        </Transition>
      </Card>
      <FormKit
        v-if="!ethereumProvider.signer.value"
        input-class="w-112 bg-orange flex flex-row justify-center"
        type="button"
        @click="requestSigner"
      >
        <div v-if="requestSignerActive" class="h-8 w-8">
          <spinner></spinner>
        </div>
        <template v-else>Connect MetaMask Wallet</template>
      </FormKit>
      <FormKit v-else class="w-72 flex flex-row justify-center bg-green" type="submit" :disabled="!valid">
        <div v-if="requestTransactionActive" class="h-8 w-8">
          <spinner></spinner>
        </div>
        <template v-else>Transfer funds</template>
      </FormKit>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { BigNumber } from 'ethers';
import { ref } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import Spinner from '@/components/Spinner.vue';
import useRequestSigner from '@/composables/useRequestSigner';
import useRequestTransaction from '@/composables/useRequestTransaction';
import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import type { RequestFormResult, SelectorOption } from '@/types/form';
import { injectStrict } from '@/utils/vue-utils';

import RequestProcessing from './RequestProcessing.vue';

const ethereumProvider = injectStrict(EthereumProviderKey);
const raisyncConfig = injectStrict(RaisyncConfigKey);

const { requestTransactionActive, executeRequestTransaction, transactionError } =
  useRequestTransaction(ethereumProvider, raisyncConfig);
const { requestSigner, requestSignerActive, requestSignerError } =
  useRequestSigner(ethereumProvider);

const isProcessing = ref(false);

// TODO improve types
const submitRequestTransaction = (formResult: {
  amount: string;
  fromChainId: SelectorOption;
  toChainId: SelectorOption;
  toAddress: string;
  tokenAddress: SelectorOption;
}) => {
  const result: RequestFormResult = {
    targetChainId: BigNumber.from(formResult.toChainId.value),
    sourceTokenAddress: formResult.tokenAddress.value,
    targetTokenAddress: formResult.tokenAddress.value,
    targetAddress: formResult.toAddress,
    amount: BigNumber.from(formResult.amount),
  };

  executeRequestTransaction(result, ethereumProvider.value.signer.value!);
  isProcessing.value = true;
};
const shownError = () => {
  const error = requestSignerError.value || transactionError.value;
  if(error) {
    isProcessing.value = false;
  }
  return error;
}

// TODO show block explorer URL on successful tx screen
// TODO prefill address with account address
</script>
