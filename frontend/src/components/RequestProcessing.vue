<template>
  <Card class="bg-teal-light p-10 mb-14 mt-2">
    <div class="flex flex-col justify-center items-center gap-4 text-black text-lg">
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
  <div class="flex flex-col justify-center items-center text-xl">
    <div>
      <ul class="steps steps-vertical">
        <ProgressStep
          :current-state="requestMetadata.state"
          :trigger-state="RequestState.WaitConfirm"
        >
          Please confirm your request on Metamask
        </ProgressStep>
        <ProgressStep
          :current-state="requestMetadata.state"
          :trigger-state="RequestState.WaitTransaction"
        >
          Waiting for transaction receipt
        </ProgressStep>
        <ProgressStep
          :current-state="requestMetadata.state"
          :trigger-state="RequestState.WaitFulfill"
        >
          Request is being fulfilled
        </ProgressStep>
        <ProgressStep
          :current-state="requestMetadata.state"
          :trigger-state="RequestState.RequestSuccessful"
        >
          Transfer completed
        </ProgressStep>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

import { RequestMetadata, RequestState } from '@/types/data';

import Card from './layout/Card.vue';
import ProgressStep from './layout/ProgressStep.vue';

interface Props {
  readonly requestMetadata: RequestMetadata;
}
defineProps<Props>();
</script>
