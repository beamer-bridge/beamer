<template>
  <div class="relative bg-transparent flex flex-col justify-between">
    <RequestSourceInputs
      ref="requestSourceInputsRef"
      v-model="requestSource"
      class="rounded-br-lg bg-teal px-4 py-4 md:px-8 md:py-6"
    />
    <div class="relative">
      <div class="absolute -top-4 flex flex-row w-full justify-center">
        <img class="h-20 w-20" src="@/assets/images/Signet.svg" />
      </div>
    </div>
    <RequestTargetInputs
      ref="requestTargetInputsRef"
      v-model="requestTarget"
      :amount="requestSource.amount"
      :source-chain="requestSource.sourceChain"
      :token="requestSource.token"
      class="rounded-tl-lg rounded-b-lg bg-teal px-6 py-4 mt-10 md:px-8 md:py-8"
    />
  </div>

  <Teleport v-if="signer" to="#action-button-portal">
    <div v-if="transferFundsButtonVisible" class="flex flex-col items-center">
      <ActionButton :disabled="submitDisabled" @click="submitForm">
        <span v-if="!creatingTransaction"> Transfer Funds </span>
        <spinner v-else size-classes="w-8 h-8" border="4"></spinner>
      </ActionButton>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Validation } from '@vuelidate/core';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';

import ActionButton from '@/components/layout/ActionButton.vue';
import RequestSourceInputs from '@/components/RequestSourceInputs.vue';
import RequestTargetInputs from '@/components/RequestTargetInputs.vue';
import Spinner from '@/components/Spinner.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { useTransferRequest } from '@/composables/useTransferRequest';
import { switchToActivities } from '@/router/navigation';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';
import type {
  RequestSource,
  RequestTarget,
  ValidRequestSource,
  ValidRequestTarget,
} from '@/types/form';

const EMPTY_SOURCE_DATA: RequestSource = {
  amount: '',
  sourceChain: null,
  token: null,
};
const EMPTY_TARGET_DATA: RequestTarget = {
  targetChain: null,
  toAddress: '',
};

const ethereumProvider = useEthereumProvider();
const { signer, signerAddress, chainId } = storeToRefs(ethereumProvider);
const transferHistory = useTransferHistory();
const { activated: transferFundsButtonVisible } = useToggleOnActivation();
const {
  create: createTransfer,
  execute: executeTransfer,
  creating: creatingTransaction,
} = useTransferRequest();
const { getTokenForChain } = useConfiguration();

const requestSource: Ref<RequestSource> = ref(EMPTY_SOURCE_DATA);
const requestTarget: Ref<RequestTarget> = ref(EMPTY_TARGET_DATA);

const requestSourceInputsRef = ref<{ v$: Validation }>();
const requestTargetInputsRef = ref<{ v$: Validation }>();

const formValid = computed(() => {
  if (!requestSourceInputsRef.value || !requestTargetInputsRef.value) {
    return false;
  }

  return !requestSourceInputsRef.value.v$.$invalid && !requestTargetInputsRef.value.v$.$invalid;
});

const submitDisabled = computed(() => {
  return !formValid.value || creatingTransaction.value;
});

const submitForm = async () => {
  if (submitDisabled.value) {
    throw new Error('Form not valid!');
  }

  const validRequestSource = requestSource as Ref<ValidRequestSource>;
  const validRequestTarget = requestTarget as Ref<ValidRequestTarget>;
  const targetToken = getTokenForChain(
    validRequestTarget.value.targetChain.value.identifier,
    validRequestSource.value.token.label,
  );

  if (!targetToken) {
    throw new Error('Invalid target token!');
  }

  const transfer = await createTransfer({
    sourceChain: validRequestSource.value.sourceChain.value,
    sourceAmount: validRequestSource.value.amount,
    targetChain: validRequestTarget.value.targetChain.value,
    toAddress: validRequestTarget.value.toAddress,
    sourceToken: validRequestSource.value.token.value,
    targetToken,
  });

  transferHistory.addTransfer(transfer);

  switchToActivities();
  resetForm();
  await nextTick();
  resetFormValidation();

  await executeTransfer(signer, signerAddress, transfer);
};

function resetForm() {
  requestSource.value = EMPTY_SOURCE_DATA;
  requestTarget.value = {
    ...EMPTY_TARGET_DATA,
    toAddress: requestTarget.value.toAddress === signerAddress.value ? signerAddress.value : '',
  };
}

function resetFormValidation() {
  if (requestSourceInputsRef.value) {
    requestSourceInputsRef.value.v$.$reset();
  }
  if (requestTargetInputsRef.value) {
    requestTargetInputsRef.value.v$.$reset();
  }
}

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});

watch(signerAddress, (currSignerAddress, prevSignerAddress) => {
  const toAddress = requestTarget.value.toAddress;

  if (!toAddress || toAddress === prevSignerAddress) {
    requestTarget.value = { ...requestTarget.value, toAddress: currSignerAddress ?? '' };
  }
});
</script>

<script lang="ts">
export default {
  // Necessary because the fallthrough attributes from Tabs should not be used in this component
  inheritAttrs: false,
};
</script>
