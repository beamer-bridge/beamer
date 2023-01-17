<template>
  <div class="relative w-full h-full pt-6 rounded-b-lg" v-bind="$attrs">
    <div class="gradient-wrapper relative w-full h-full">
      <div
        ref="listElement"
        class="w-full h-full overflow-y-auto overflow-hidden pb-20 no-scrollbar"
      >
        <div
          v-if="transfers.length === 0 && signer"
          class="text-xl w-full h-full flex justify-center items-center text-sea-green/40"
        >
          <span>Nothing here yet.</span>
        </div>

        <div v-if="signer">
          <template v-for="(group, groupIndex) of groupedAndSortedTransfers" :key="group.label">
            <LazyWrapper
              v-if="group.transfers.length > 0"
              :root-element="listElement"
              :threshold="0.0"
            >
              <div v-if="group.transfers.length > 0" class="text-xl text-center">
                {{ group.label }}
              </div>
            </LazyWrapper>
            <LazyWrapper
              v-for="(transfer, groupTransferIndex) of group.transfers"
              :key="
                transfer.requestInformation?.identifier ?? `${groupIndex}-${groupTransferIndex}`
              "
              :threshold="0.0"
              :root-element="listElement"
            >
              <TransferComponent
                v-if="group.transfers.length > 0"
                :transfer="transfer"
                class="my-3"
                data-test="transfer"
              />
            </LazyWrapper>
            <div v-if="group.transfers.length > 0" class="h-12"></div>
          </template>
        </div>
        <div
          v-else
          class="text-xl w-full h-full flex justify-center items-center text-sea-green/40"
        >
          Connect wallet to view activity.
        </div>
      </div>
    </div>
  </div>

  <SafeTeleport to="#action-button-portal">
    <ActionButton
      v-if="newTransferButtonVisible"
      class="bg-lime"
      data-test="switch-to-request-button"
      @click="switchToRequestDialog"
    >
      New Transfer
    </ActionButton>
  </SafeTeleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { ref } from 'vue';

import type { Transfer } from '@/actions/transfers';
import ActionButton from '@/components/layout/ActionButton.vue';
import LazyWrapper from '@/components/layout/LazyWrapper.vue';
import SafeTeleport from '@/components/layout/SafeTeleport.vue';
import TransferComponent from '@/components/Transfer.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { useTransferGrouping } from '@/composables/useTransferGrouping';
import { switchToRequestDialog } from '@/router/navigation';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';

const { activated: newTransferButtonVisible } = useToggleOnActivation();
const listElement = ref();
const transferHistory = useTransferHistory();
const { transfers } = storeToRefs(transferHistory);
const ethereumProvider = useEthereumProvider();
const { signer } = storeToRefs(ethereumProvider);

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
