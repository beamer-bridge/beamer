<template>
  <Tooltip class="inline" :hint="hint" show-outside-of-closest-reference-element>
    <span data-test="address" class="cursor-copy" @click="copyAddress">{{ shortenAddress }}</span>
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

const shortenAddress = computed(
  () => `${props.address.slice(0, 4)}...${props.address.slice(38, 42)}`,
);

const timeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined);
const clipboardAvailable = navigator && navigator.clipboard;
const showCopyTooltip = ref(false);

const hint = computed(() => {
  if (showCopyTooltip.value) {
    return 'Copied!';
  } else {
    return props.address + (clipboardAvailable ? ' (copy)' : '');
  }
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
