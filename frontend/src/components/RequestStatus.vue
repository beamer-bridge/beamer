<template>
  <Card class="bg-teal-light p-10 mb-14 mt-2">
    <div class="flex flex-col justify-center items-center gap-4 text-black text-lg">
      <RequestSummary v-bind="metadata" />
    </div>
  </Card>
  <div class="flex flex-col justify-center items-center text-xl">
    <div>
      <RequestProcessing :state="state" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from '@/components/layout/Card.vue';
import RequestProcessing from '@/components/RequestProcessing.vue';
import RequestSummary from '@/components/RequestSummary.vue';
import { RequestMetadata, RequestState } from '@/types/data';

interface Props {
  metadata: RequestMetadata;
  state: RequestState;
}

defineProps<Props>();
</script>
