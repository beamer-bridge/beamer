<template>
  <ul class="steps steps-vertical">
    <ProgressStep
      v-for="(step, index) in progressSteps"
      :key="index"
      :label="step.label"
      :completed="step.completed"
      :failed="step.failed"
    />
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ProgressStep from '@/components/layout/ProgressStep.vue';
import { RequestState } from '@/types/data';

interface Props {
  readonly state: RequestState;
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
