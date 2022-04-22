<template>
  <Card class="bg-teal-light p-10 mb-14 mt-2">
    <div
      class="flex flex-col justify-center items-center gap-4 text-black text-lg"
      data-test="request-summary"
    >
      <div class="flex flex-col justify-center items-center">
        <div>
          Sending <span>{{ Number(requestMetadata.amount).toFixed(2) }}&nbsp;</span>
          <span>{{ requestMetadata.tokenSymbol }}</span>
        </div>
        <div>
          from <span>{{ requestMetadata.sourceChainName }}</span>
        </div>
        <div>
          to <span>{{ requestMetadata.targetChainName }}</span>
        </div>
      </div>
      <div class="flex flex-col justify-center items-center">
        <div>Recipient address</div>
        <div>{{ requestMetadata.targetAddress }}</div>
      </div>
    </div>
  </Card>
  <div class="flex flex-col justify-center items-center text-xl" data-test="request-progress">
    <div>
      <ul class="steps">
        <ProgressStep
          v-for="(step, index) in progressSteps"
          :key="index"
          :label="step.label"
          :completed="step.completed"
          :failed="step.failed"
        />
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { RequestMetadata, RequestState } from '@/types/data';

import Card from './layout/Card.vue';
import ProgressStep from './layout/ProgressStep.vue';

interface Props {
  readonly requestMetadata: RequestMetadata;
}

const props = defineProps<Props>();

const progressSteps = computed(() => [
  {
    label: 'Please confirm your request on Metamask',
    completed: props.requestMetadata.state >= RequestState.WaitConfirm,
  },
  {
    label: 'Waiting for transaction receipt',
    completed: props.requestMetadata.state >= RequestState.WaitTransaction,
  },
  {
    label: 'Request is being fulfilled',
    completed: props.requestMetadata.state >= RequestState.WaitFulfill,
  },
  {
    label: 'Transfer completed',
    completed: props.requestMetadata.state >= RequestState.RequestSuccessful,
    failed: props.requestMetadata.state == RequestState.RequestFailed,
  },
]);
</script>
