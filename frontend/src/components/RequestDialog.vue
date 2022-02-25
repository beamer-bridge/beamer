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
      ref="requestForm"
      v-slot="{ state: { valid } }"
      form-class="flex flex-col items-center"
      type="form"
      :actions="false"
      @submit="submitRequestTransaction"
    >
      <Card class="bg-teal px-20 pt-18 pb-14 self-stretch mb-11">
        <RequestFormInputs v-if="requestState === RequestState.Init" :fees="feesEther" />
        <RequestProcessing v-else :request-metadata="requestMetadata" />
        <Transition name="expand">
          <div v-if="shownError()" class="mt-7 text-right text-lg text-orange-dark">
            {{ shownError() }}
          </div>
        </Transition>
      </Card>

      <div v-if="!ethereumProvider.signer.value">
        <FormKit
          input-class="w-112 bg-orange flex flex-row justify-center"
          type="button"
          @click="requestSigner"
        >
          <div v-if="requestSignerActive" class="h-8 w-8">
            <spinner></spinner>
          </div>
          <template v-else>Connect MetaMask Wallet</template>
        </FormKit>
      </div>
      <div v-else>
        <FormKit
          v-if="requestState === RequestState.Init"
          class="w-72 flex flex-row justify-center bg-green"
          type="submit"
          :disabled="!valid"
        >
          <div v-if="requestTransactionActive" class="h-8 w-8">
            <spinner></spinner>
          </div>
          <template v-else>Transfer funds</template>
        </FormKit>
        <FormKit
          v-if="requestState === RequestState.RequestSuccessful"
          input-class="w-112 bg-green flex flex-row justify-center"
          type="button"
          @click="newTransfer"
        >
          New Transfer
        </FormKit>
      </div>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { FormKitFrameworkContext } from '@formkit/core';
import { BigNumber, utils } from 'ethers';
import { computed, ref, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import Spinner from '@/components/Spinner.vue';
import useRequestSigner from '@/composables/useRequestSigner';
import {
  useGetFee,
  useRequestTransaction,
  useWaitRequestFilled,
} from '@/composables/useRequestTransaction';
import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import { Request, RequestMetadata, RequestState } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { injectStrict } from '@/utils/vue-utils';

import RequestProcessing from './RequestProcessing.vue';

const ethereumProvider = injectStrict(EthereumProviderKey);
const raisyncConfig = injectStrict(RaisyncConfigKey);

const requestMetadata = ref<RequestMetadata>();
const requestForm = ref<FormKitFrameworkContext>();

const { fee, getFeeActive, getFeeError, executeGetFee } = useGetFee(
  ethereumProvider,
  raisyncConfig,
);
const { requestTransactionActive, requestState, transactionError, executeRequestTransaction } =
  useRequestTransaction(ethereumProvider, raisyncConfig);
const { waitFulfilledActive, waitError, executeWaitFulfilled } = useWaitRequestFilled(
  ethereumProvider,
  raisyncConfig,
);
const { requestSigner, requestSignerActive, requestSignerError } =
  useRequestSigner(ethereumProvider);

const isProcessing = ref(false);
const feesEther = computed(() => {
  if (fee.value) {
    return utils.formatEther(fee.value);
  }
  return '';
});

const newTransfer = async (formResult: {}) => {
  requestState.value = RequestState.Init;
  location.reload();
};
// TODO improve types
const submitRequestTransaction = async (formResult: {
  amount: string;
  fromChainId: SelectorOption;
  toChainId: SelectorOption;
  toAddress: string;
  tokenAddress: SelectorOption;
}) => {
  // TODO pre-fetch the fees as soon as the form-result is complete
  // set the fees on the request object and don't fetch again
  // FIXME if the user selects a different sourceChainId from the dropdown
  // 	than activated in MetaMask, the chosen chain will not take effect but rather
  // 	the active MetaMask chain is used anyways
  // TODO -> if source chain is different than current active chain, call the provider.switchChain before
  // 	continueing
  const request: Request = {
    targetChainId: Number(formResult.toChainId.value),
    sourceTokenAddress: formResult.tokenAddress.value,
    sourceChainId: Number(formResult.fromChainId.value),
    targetTokenAddress: formResult.tokenAddress.value,
    targetAddress: formResult.toAddress,
    amount: BigNumber.from(formResult.amount),
  };
  // await executeGetFee(request, ethereumProvider.value.signer.value!);

  requestMetadata.value = {
    state: requestState,
    tokenSymbol: formResult.tokenAddress.label,
    sourceChainName: formResult.toChainId.label,
    targetChainName: formResult.fromChainId.label,
    targetAddress: request.targetAddress,
    amount: formResult.amount,
    fee: feesEther.value,
  };
  request.fee = fee.value;

  await executeRequestTransaction(request, ethereumProvider.value.signer.value!);

  await executeWaitFulfilled(request, requestState, ethereumProvider.value.signer.value!);
};

watch(ethereumProvider.value.chainId, async () => {
  await executeGetFee(ethereumProvider.value.signer.value!);
});
executeGetFee(ethereumProvider.value.signer.value!);

const shownError = () => {
  const error = requestSignerError.value || transactionError.value;
  if (error) {
    requestState.value = RequestState.Init;
  }
  return error;
};

// TODO show block explorer URL on successful tx screen
// TODO prefill address with account address
</script>
