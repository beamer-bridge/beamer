<template>
  <div class="relative w-full h-full pt-3">
    <!-- Top gradient to create phase out effect for scrolling content. -->
    <div
      class="absolute top-0 right-0 w-full h-10 z-10 bg-gradient-to-t from-transparent to-teal"
    />

    <div
      ref="listElement"
      class="w-full h-full overflow-y-auto overflow-hidden pb-20 no-scrollbar"
    >
      <LazyWrapper
        v-for="group of groupedAndSortedTransfers"
        :key="group.label"
        :root-element="listElement"
        :threshold="0.0"
        class="mb-12"
        data-test="transfer-group"
      >
        <div v-if="group.transfers.length > 0" class="text-2xl text-center">
          {{ group.label }}
        </div>

        <LazyWrapper :threshold="0.0">
          <TransferStatus
            v-for="(transfer, groupTransferIndex) of group.transfers"
            :key="transfer.requestInformation?.identifier?.asString ?? groupTransferIndex"
            :transfer="transfer"
            class="my-3"
          />
        </LazyWrapper>
      </LazyWrapper>
    </div>

    <!-- Bottom gradient to create phase out effect for scrolling content. -->
    <div class="absolute bottom-0 right-0 w-full h-10 z-10 bg-gradient-to-t from-teal" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { ref } from 'vue';

import type { Transfer } from '@/actions/transfers';
import LazyWrapper from '@/components/layout/LazyWrapper.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import { useTransferGrouping } from '@/composables/useTransferGrouping';
import { useTransferHistory } from '@/stores/transfer-history';

const listElement = ref();
const transferHistory = useTransferHistory();
const { transfers } = storeToRefs(transferHistory);
const timeWindows = ref([
  { label: 'today', priority: 3, maxDaysAgo: 1 },
  { label: '3 days ago', priority: 2, maxDaysAgo: 3 },
  { label: 'last week', priority: 1, maxDaysAgo: 7 },
]);
const { groupedAndSortedTransfers } = useTransferGrouping(
  transfers as Ref<Array<Transfer>>,
  timeWindows,
);
</script>

<style>
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
