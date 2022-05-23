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
      <div class="flex flex-col gap-10 items-center text-lg" data-test="body">
        <TransferSummary v-bind="summary" />
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

  return {
    date: transfer.date,
    amount: transfer.sourceAmount.decimalAmount,
    tokenSymbol: transfer.sourceAmount.token.symbol,
    sourceChainName: transfer.sourceChain.name,
    targetChainName: transfer.targetChain.name,
    targetAccount: transfer.targetAccount,
    requestTransactionUrl: transfer.requestInformation?.transactionHash
      ? `${transfer.sourceChain.explorerTransactionUrl}${transfer.requestInformation?.transactionHash}`
      : undefined,
  };
});

const progressSteps = computed(() =>
  props.transfer.steps.map((step) => ({
    label: step.label,
    completed: step.completed,
    failed: step.failed,
  })),
);

const statusBackgroundColorClass = computed(() => {
  const { active, completed, failed } = props.transfer;
  return failed ? 'bg-orange-dark' : completed ? 'bg-green' : active ? 'bg-green-lime' : 'bg-grey';
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
