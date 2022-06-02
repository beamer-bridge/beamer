<template>
  <Expandable
    class="bg-teal-light rounded-[2rem] p-6 mb-5 gap-5 text-black"
    :is-expanded="isExpanded"
  >
    <template #header>
      <div class="relative text-center text-xl" data-test="header">
        {{ shortenAmountDecimals }}
        {{ transfer.sourceAmount.token.symbol }}
        &nbsp;to&nbsp;
        {{ transfer.targetChain.name }}

        <div
          class="w-6 h-6 rounded-full absolute right-0 top-0"
          :class="[statusBackgroundColorClass]"
        />
      </div>
    </template>

    <template #body>
      <div class="flex flex-col gap-5 items-center text-lg" data-test="body">
        <TransferSummary v-bind="summary" />
        <TransferStatus v-bind="status" />
        <Progress v-if="!transfer.completed" :steps="progressSteps" />
      </div>
    </template>
  </Expandable>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { Transfer } from '@/actions/transfers';
import Expandable from '@/components/layout/Expandable.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';

interface Props {
  transfer: Transfer;
}

const props = defineProps<Props>();
const isExpanded = ref(props.transfer.active);
const shortenAmountDecimals = computed(() => {
  const { decimalAmount } = props.transfer.sourceAmount;
  const [beforeDot, afterDot] = decimalAmount.split('.');
  return `${beforeDot}.${(afterDot ?? '00').slice(0, 2)}`;
});

const summary = computed(() => {
  const { transfer } = props;

  const { completed, active, failed } = transfer;
  const statusLabel = completed ? 'Completed' : failed ? 'Failed' : active ? 'In Progress' : '';
  const statusColor = completed ? 'green' : failed ? 'red' : active ? 'green-lime' : 'black';

  const { sourceChain, requestInformation } = transfer;
  const { transactionHash } = requestInformation ?? {};
  const { explorerTransactionUrl } = sourceChain;
  const requestTransactionUrl = transactionHash
    ? `${explorerTransactionUrl}${transactionHash}`
    : undefined;

  const { date, targetAccount, sourceAmount, targetChain } = transfer;

  return {
    date,
    amount: sourceAmount.decimalAmount,
    tokenSymbol: sourceAmount.token.symbol,
    sourceChainName: sourceChain.name,
    targetChainName: targetChain.name,
    targetAccount,
    statusLabel,
    statusColor,
    requestTransactionUrl,
  };
});

const status = computed(() => {
  const { completed, failed, active } = props.transfer;
  return { completed, failed, active };
});

const progressSteps = computed(() =>
  props.transfer.steps.map((step) => ({
    label: step.label,
    completed: step.completed,
    failed: step.failed,
    errorMessage: step.errorMessage,
  })),
);

const statusBackgroundColorClass = computed(() => {
  const { active, completed, failed } = props.transfer;
  return failed ? 'bg-red' : completed ? 'bg-green' : active ? 'bg-green-lime' : 'bg-grey';
});

watch(
  () => props.transfer.active,
  () => {
    // Use a timeout for both cases to avoid timer management.
    const timeout = props.transfer.active ? 0 : 7000;
    setTimeout(() => (isExpanded.value = props.transfer.active), timeout);
  },
);
</script>
