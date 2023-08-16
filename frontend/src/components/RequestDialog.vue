<template>
  <div class="relative flex flex-col justify-between bg-transparent">
    <RequestSourceInputs
      ref="requestSourceInputsRef"
      v-model="requestSource"
      :target-chain="requestTarget.targetChain"
      class="rounded-br-lg bg-teal px-4 py-4 md:px-8 md:py-6"
    />
    <div class="relative">
      <div class="absolute -top-4 flex w-full flex-row justify-center">
        <img class="h-20 w-20" src="@/assets/images/Signet.svg" />
      </div>
    </div>
    <RequestTargetInputs
      ref="requestTargetInputsRef"
      v-model="requestTarget"
      :amount="requestSource.amount"
      :source-chain="requestSource.sourceChain"
      :token="requestSource.token"
      class="mt-10 rounded-b-lg rounded-tl-lg bg-teal px-6 py-4 md:px-8 md:py-8"
    />
  </div>

  <Teleport v-if="signer" to="#action-button-portal">
    <div v-if="transferFundsButtonVisible" class="flex flex-col items-center">
      <div
        v-if="hasPendingTransactions"
        class="mb-7 rounded-lg bg-teal px-6 py-4 text-center text-sm md:px-8 md:py-8"
      >
        You have a pending transaction, that needs to complete before being able to make a new
        transfer.
      </div>
      <div
        v-if="showInfiniteApprovalCheckbox"
        class="mb-7 flex flex-row items-center justify-center gap-2 pl-2"
      >
        <input
          v-model="approveInfiniteAmount"
          type="checkbox"
          class="h-5 w-5 appearance-none rounded-md bg-sea-green shadow-inner checked:after:text-2xl checked:after:leading-6 checked:after:text-teal checked:after:content-['\2713'] hover:opacity-90"
        />
        <span class="text-sm">Approve maximum token allowance</span>
        <Tooltip>
          <div class="flex h-full flex-col justify-center">
            <img class="h-5 w-5 cursor-help" src="@/assets/images/help.svg" />
          </div>
          <template #hint>
            <div class="max-w-sm">
              Save time and money on transaction fees by ticking this box to skip the recurring
              access permission step for future transfers with Beamer. You only need to approve
              once per token and rollup/chain. Please keep in mind the risks if you use this
              option.
            </div>
          </template>
        </Tooltip>
      </div>
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
import Tooltip from '@/components/layout/Tooltip.vue';
import RequestSourceInputs from '@/components/RequestSourceInputs.vue';
import RequestTargetInputs from '@/components/RequestTargetInputs.vue';
import Spinner from '@/components/Spinner.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { useTokenAllowance } from '@/composables/useTokenAllowance';
import { useTransferRequest } from '@/composables/useTransferRequest';
import { switchToActivities } from '@/router/navigation';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
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

const { signer, signerAddress, provider } = storeToRefs(useEthereumWallet());
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

const hasPendingTransactions = computed(() => {
  const selectedChainId = requestSource.value.sourceChain?.value.identifier;
  if (!selectedChainId) {
    return false;
  }
  return transferHistory.hasPendingTransactionsForChain(selectedChainId);
});

const approveInfiniteAmount = ref(false);
const { allowanceBelowMax: showInfiniteApprovalCheckbox } = useTokenAllowance(
  provider,
  computed(() => requestSource.value.token?.value),
  computed(() => requestSource.value.sourceChain?.value),
);

const submitDisabled = computed(() => {
  return !formValid.value || creatingTransaction.value || hasPendingTransactions.value;
});

const submitForm = async () => {
  if (submitDisabled.value) {
    throw new Error('Form not valid!');
  }
  if (!provider.value?.signerAddress.value) {
    throw new Error('Cannot create transfer without signer!');
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
    approveInfiniteAmount: approveInfiniteAmount.value,
    requestCreatorAddress: provider.value?.signerAddress.value,
  });

  transferHistory.addTransfer(transfer);

  switchToActivities();
  resetForm();
  await nextTick();
  resetFormValidation();

  await executeTransfer(provider.value, transfer);
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

watch(signerAddress, (currSignerAddress, prevSignerAddress) => {
  // Contract providers should not prefill the target address as they need to be deployed separately per chain
  if (provider.value && provider.value.isContractWallet) {
    return;
  }

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
