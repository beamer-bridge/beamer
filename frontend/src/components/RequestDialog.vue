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
      <Card class="bg-teal px-20 pt-18 pb-16 self-stretch mb-11">
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
          v-if="requestState !== RequestState.Init"
          input-class="w-72 flex flex-row justify-center bg-green"
          type="button"
          :disabled="isNewTransferDisabled"
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
import { FormKit } from '@formkit/vue';
import { utils } from 'ethers';
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
import { BeamerConfigKey, EthereumProviderKey } from '@/symbols';
import { Request, RequestMetadata, RequestState } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { injectStrict } from '@/utils/vue-utils';

import RequestProcessing from './RequestProcessing.vue';

interface Emits {
  (e: 'reload'): void;
}

const emit = defineEmits<Emits>();

const ethereumProvider = injectStrict(EthereumProviderKey);
const beamerConfig = injectStrict(BeamerConfigKey);

const requestMetadata = ref<RequestMetadata>();
const requestForm = ref<FormKitFrameworkContext>();

const transactionError = ref('');

const { fee, executeGetFee } = useGetFee(ethereumProvider, beamerConfig);
const { requestTransactionActive, requestState, executeRequestTransaction } =
  useRequestTransaction(ethereumProvider, beamerConfig);
const { executeWaitFulfilled } = useWaitRequestFilled(beamerConfig);
const { requestSigner, requestSignerActive, requestSignerError } =
  useRequestSigner(ethereumProvider);
const getTargetTokenAddress = (targetChainId: any, tokenSymbol: string) => {
  return beamerConfig.value.chains[targetChainId].tokens.find(
    (token) => token.symbol === tokenSymbol,
  )?.address as string;
};

const feesEther = computed(() => {
  if (fee.value) {
    return utils.formatEther(fee.value);
  }
  return '';
});

const newTransfer = async () => {
  emit('reload');
};
// TODO improve types
const submitRequestTransaction = async (formResult: {
  amount: string;
  fromChainId: SelectorOption;
  toChainId: SelectorOption;
  toAddress: string;
  tokenAddress: SelectorOption;
}) => {
  if (!ethereumProvider.value.signer.value) {
    throw new Error('No signer available!');
  }

  try {
    const request: Request = {
      targetChainId: Number(formResult.toChainId.value),
      sourceTokenAddress: formResult.tokenAddress.value,
      sourceChainId: Number(formResult.fromChainId.value),
      targetTokenAddress: getTargetTokenAddress(
        formResult.toChainId.value,
        formResult.tokenAddress.label,
      ),
      targetAddress: formResult.toAddress,
      amount: formResult.amount,
    };

    requestMetadata.value = {
      state: requestState,
      tokenSymbol: formResult.tokenAddress.label,
      sourceChainName: formResult.fromChainId.label,
      targetChainName: formResult.toChainId.label,
      targetAddress: request.targetAddress,
      amount: formResult.amount,
      fee: feesEther.value,
    };
    request.fee = fee.value;

    transactionError.value = '';
    await executeRequestTransaction(request, ethereumProvider.value.signer.value);

    await executeWaitFulfilled(request, requestState);
  } catch (error: any) {
    transactionError.value = error.message;
  }
};

watch(ethereumProvider.value.chainId, async () => {
  await executeGetFee();
});
executeGetFee();

const isNewTransferDisabled = computed(() => {
  return (
    requestState.value !== RequestState.RequestSuccessful &&
    requestState.value !== RequestState.RequestFailed
  );
});

const shownError = () => {
  const error = requestSignerError.value || transactionError.value;
  if (error) {
    requestState.value = RequestState.Init;
  }
  return error;
};
</script>
