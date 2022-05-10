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

import Card from '@/components/layout/Card.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import { RequestMetadata, RequestState } from '@/types/data';

interface Props {
  metadata: RequestMetadata;
  state: RequestState;
}

const props = defineProps<Props>();

const progressSteps = computed(() => [
  {
    label: 'Please confirm your request on Metamask',
    completed: props.state >= RequestState.WaitConfirm,
  },
  {
    label: 'Waiting for transaction receipt',
    completed: props.state >= RequestState.WaitTransaction,
  },
  {
    label: 'Request is being fulfilled',
    completed: props.state >= RequestState.WaitFulfill,
  },
  {
    label: 'Transfer completed',
    completed: props.state >= RequestState.RequestSuccessful,
    failed: props.state == RequestState.RequestFailed,
  },
]);
</script>
