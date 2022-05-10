<template>
  <Card class="bg-teal-light p-10 mb-14 mt-2">
    <div class="flex flex-col justify-center items-center gap-4 text-black text-lg">
      <TransferSummary v-bind="metadata" />
    </div>
  </Card>
  <div class="flex flex-col justify-center items-center text-xl">
    <div>
      <Progress :steps="progressSteps" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Transfer } from '@/actions/transfer';
import Card from '@/components/layout/Card.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferSummary from '@/components/TransferSummary.vue';

interface Props {
  transfer: Transfer;
}

const props = defineProps<Props>();

const metadata = computed(() => {
  const { transfer } = props;

  return {
    amount: `${transfer.amount}`, // TODO: format!
    tokenSymbol: transfer.sourceToken.symbol,
    sourceChainName: transfer.sourceChain.name,
    targetChainName: transfer.targetChain.name,
    targetAccount: transfer.targetAccount,
  };
});

const progressSteps = computed(() =>
  props.transfer.steps.map((step) => ({
    label: step.label,
    completed: step.completed,
    failed: step.failed,
  })),
);
</script>
