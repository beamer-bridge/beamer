<template>
  <Tooltip :disable-click-away="true" :show="showCopytoolTipOn">
    <span data-test="address" class="cursor-copy" @click="copyAddress"
      >{{ shortenedAddress }}
      <img src="@/assets/images/copy.svg" class="inline pl-1" />
    </span>
    <template #hint>
      <div class="relative w-[5rem]">
        <span v-show="!showCopytoolTipOn">Copy </span>
        <span v-if="showCopytoolTipOn"> Copied! </span>
      </div>
    </template>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';

import Tooltip from '@/components/layout/Tooltip.vue';
import type { EthereumAddress } from '@/types/data';

interface Props {
  address: EthereumAddress;
}

const props = defineProps<Props>();

const shortenedAddress = computed(
  () => `${props.address.slice(0, 6)}...${props.address.slice(38, 42)}`,
);
const timeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined);
const clipboardAvailable = navigator && navigator.clipboard;
const showCopyTooltip = ref(false);

const showCopytoolTipOn = computed(() => {
  return showCopyTooltip.value === false ? null : true;
});

async function copyAddress() {
  if (clipboardAvailable) {
    await navigator.clipboard.writeText(props.address);
    showCopyTooltip.value = true;
    timeout.value = setTimeout(() => (showCopyTooltip.value = false), 1000);
  }
}

onUnmounted(() => {
  if (timeout.value) {
    clearTimeout(timeout.value);
  }
});
</script>
