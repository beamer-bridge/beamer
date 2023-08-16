<template>
  <Expandable
    class="mb-2 gap-3 rounded-[2rem] bg-sea-green p-3 text-black"
    :is-expanded="isExpanded"
  >
    <template #header>
      <div class="relative w-full pr-6 text-center" data-test="header">
        {{ formattedAmount }}&nbsp;to&nbsp;{{ transfer.targetChain.name }}
        <div
          class="absolute right-1 top-1 h-4 w-4 rounded-full"
          :class="[statusBackgroundColorClass]"
        />
      </div>
    </template>

    <template #body>
      <div class="flex flex-col items-center gap-5" data-test="body">
        <TransferSummary v-bind="summary">
          <TransferStatus v-bind="status" />
        </TransferSummary>
        <TransferWithdrawer
          v-if="transfer.expired"
          v-bind="withdrawProperties"
          @withdraw="withdrawTransfer"
        />
        <Progress v-if="!transfer.completed" :steps="progressSteps" />
      </div>
    </template>
  </Expandable>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Expandable from '@/components/layout/Expandable.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import TransferWithdrawer from '@/components/TransferWithdrawer.vue';
import { useTransferRequest } from '@/composables/useTransferRequest';
import { useEthereumWallet } from '@/stores/ethereum-wallet';

interface Props {
  transfer: Transfer;
}

const props = defineProps<Props>();
const isExpanded = ref(props.transfer.active);
const formattedAmount = computed(() => props.transfer.sourceAmount.format());

const requestTransactionUrl = computed(() => {
  const { explorerUrl } = props.transfer.sourceChain;
  const { transactionHash } = props.transfer.requestInformation ?? {};
  return transactionHash ? `${explorerUrl}/tx/${transactionHash}` : undefined;
});

const summary = computed(() => ({
  date: props.transfer.date,
  amount: props.transfer.sourceAmount.decimalAmount,
  tokenSymbol: props.transfer.sourceAmount.token.symbol,
  sourceChainName: props.transfer.sourceChain.name,
  targetChainName: props.transfer.targetChain.name,
  targetAccount: props.transfer.targetAccount,
  requestTransactionUrl: requestTransactionUrl.value,
}));

const status = computed(() => {
  const { completed, failed, expired, active } = props.transfer;
  return { completed, failed, expired, active };
});

const progressSteps = computed(() =>
  props.transfer.steps.map((step) => ({
    label: step.label,
    active: step.active,
    completed: step.completed,
    failed: step.failed,
    errorMessage: step.errorMessage,
  })),
);

const statusBackgroundColorClass = computed(() => {
  const { active, completed, failed } = props.transfer;
  return failed ? 'bg-red' : completed ? 'bg-green' : active ? 'bg-lime' : 'bg-grey';
});

const { provider } = storeToRefs(useEthereumWallet());
const {
  withdraw: runWithdrawTransfer,
  withdrawError: withdrawTransferError,
  withdrawing: withdrawTransferActive,
} = useTransferRequest();

const withdrawProperties = computed(() => ({
  withdrawn: props.transfer.withdrawn,
  withdrawable: props.transfer.withdrawable,
  withdrawInProgress: withdrawTransferActive.value,
  errorMessage: withdrawTransferError.value?.message,
}));

function withdrawTransfer() {
  runWithdrawTransfer(props.transfer, provider.value);
}

watch(
  () => props.transfer.active,
  () => {
    // Use a timeout for both cases to avoid timer management.
    const timeout = props.transfer.active ? 0 : 7000;
    setTimeout(() => (isExpanded.value = props.transfer.active), timeout);
  },
);
</script>
