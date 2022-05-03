<template>
  <div class="request-dialog">
    <div class="h-14">
      <div v-if="ethereumProvider.signer" class="flex flex-row gap-4 justify-center items-center">
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
      <Card class="bg-teal px-20 pt-18 pb-16 self-stretch mb-11">
        <RequestFormInputs v-if="requestState === RequestState.Init" />
        <RequestProcessing v-else :request-metadata="requestMetadata" />
        <Transition name="expand">
          <div v-if="shownError" class="mt-7 text-right text-lg text-orange-dark">
            {{ shownError }}
          </div>
        </Transition>
      </Card>

      <div v-if="!ethereumProvider.signer">
        <FormKit
          input-class="w-112 bg-orange flex flex-row justify-center"
          type="button"
          @click="runRequestSigner"
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
          v-if="requestState !== RequestState.Init"
          input-class="w-72 flex flex-row justify-center bg-green"
          type="button"
          :disabled="isNewTransferDisabled"
          @click="newTransfer"
          >New Transfer</FormKit
        >
      </div>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { JsonRpcProvider } from '@ethersproject/providers';
import { FormKitFrameworkContext } from '@formkit/core';
import { FormKit } from '@formkit/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import Spinner from '@/components/Spinner.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useRequestSigner } from '@/composables/useRequestSigner';
import { useRequestTransaction } from '@/composables/useRequestTransaction';
import { useWaitForRequestFulfilment } from '@/composables/useWaitForRequestFulfilment';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { Request, RequestMetadata, RequestState } from '@/types/data';
import type { SelectorOption } from '@/types/form';

import RequestProcessing from './RequestProcessing.vue';

interface Emits {
  (e: 'reload'): void;
}

const emit = defineEmits<Emits>();

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const requestMetadata = ref<RequestMetadata>();
const requestForm = ref<FormKitFrameworkContext>();

const transactionError = ref('');

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { amount: requestFeeAmount } = useRequestFee(provider, requestManagerAddress);

const {
  active: requestTransactionActive,
  state: requestState,
  run: executeRequestTransaction,
} = useRequestTransaction();

const { run: waitForRequestFulfilment } = useWaitForRequestFulfilment();

const {
  run: requestSigner,
  active: requestSignerActive,
  error: requestSignerError,
} = useRequestSigner();

const runRequestSigner = () => {
  // TOOD: In future we will not separate getting provider and signer which
  // resolve the undefined provider case.
  if (provider.value) {
    requestSigner(provider.value);
  }
};

const getTargetTokenAddress = (targetChainId: number, tokenSymbol: string) => {
  return configuration.chains[targetChainId].tokens.find((token) => token.symbol === tokenSymbol)
    ?.address as string;
};

const newTransfer = async () => {
  emit('reload');
};

// TODO improve types
const submitRequestTransaction = async (formResult: {
  amount: string;
  sourceChainId: SelectorOption;
  targetChainId: SelectorOption;
  toAddress: string;
  tokenAddress: SelectorOption;
}) => {
  if (!provider.value || !signer.value) {
    throw new Error('No signer available!');
  }

  const request: Request = {
    targetChainId: Number(formResult.targetChainId.value),
    sourceTokenAddress: formResult.tokenAddress.value,
    sourceChainId: Number(formResult.sourceChainId.value),
    targetTokenAddress: getTargetTokenAddress(
      formResult.targetChainId.value,
      formResult.tokenAddress.label,
    ),
    targetAddress: formResult.toAddress,
    amount: formResult.amount,
  };

  requestMetadata.value = {
    state: requestState,
    tokenSymbol: formResult.tokenAddress.label,
    sourceChainName: formResult.sourceChainId.label,
    targetChainName: formResult.targetChainId.label,
    targetAddress: request.targetAddress,
    amount: formResult.amount,
  };
  (request.fee = requestFeeAmount.value), (transactionError.value = '');

  const targetChainRpcUrl = configuration.chains[formResult.targetChainId.value].rpcUrl;
  const targetChainProvider = new JsonRpcProvider(targetChainRpcUrl);
  const fillManagerAddress =
    configuration.chains[formResult.targetChainId.value].fillManagerAddress;

  try {
    await executeRequestTransaction(
      provider.value,
      signer.value,
      requestManagerAddress.value,
      request,
    );
    await waitForRequestFulfilment(targetChainProvider, fillManagerAddress, request, requestState);
  } catch (error) {
    const maybeErrorMessage = (error as { message?: string }).message;
    if (maybeErrorMessage) {
      transactionError.value = maybeErrorMessage;
    } else {
      transactionError.value = 'Unknown failure!';
    }
  }
};

watch(chainId, () => location.reload());

const isNewTransferDisabled = computed(() => {
  return (
    requestState.value !== RequestState.RequestSuccessful &&
    requestState.value !== RequestState.RequestFailed
  );
});

const shownError = computed(() => {
  return requestSignerError.value || transactionError.value;
});

watch(shownError, async () => {
  if (shownError.value && requestState.value !== RequestState.RequestFailed) {
    requestState.value = RequestState.Init;
  }
});
</script>
