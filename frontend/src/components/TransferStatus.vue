<template>
  <Card class="bg-teal-light p-10 mb-14 mt-2">
    <div class="flex flex-col justify-center items-center gap-4 text-black text-lg">
      <TransferSummary v-bind="metadata" />
    </div>
  </Card>
  <div class="flex flex-col justify-center items-center text-xl">
    <div>
      <TransferProcessing :state="state" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from '@/components/layout/Card.vue';
import TransferProcessing from '@/components/TransferProcessing.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import { RequestMetadata, RequestState } from '@/types/data';

interface Props {
  metadata: RequestMetadata;
  state: RequestState;
}

defineProps<Props>();
</script>
