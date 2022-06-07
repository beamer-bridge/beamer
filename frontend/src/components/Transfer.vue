<template>
  <Expandable
    class="bg-teal-light rounded-[2rem] p-6 mb-5 gap-5 text-black"
    :is-expanded="isExpanded"
  >
    <template #header>
      <div class="relative text-center text-xl" data-test="header">
        {{ formattedAmount }}&nbsp;to&nbsp;{{ transfer.targetChain.name }}
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
const formattedAmount = computed(() => props.transfer.sourceAmount.format({ decimalPlaces: 2 }));

const requestTransactionUrl = computed(() => {
  const { explorerTransactionUrl } = props.transfer.sourceChain;
  const { transactionHash } = props.transfer.requestInformation ?? {};
  return transactionHash ? `${explorerTransactionUrl}${transactionHash}` : undefined;
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
  const { completed, failed, active } = props.transfer;
  return { completed, failed, active };
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
