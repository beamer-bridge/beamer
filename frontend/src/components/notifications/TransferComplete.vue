<template>
  <div>
    Transfer completed <span v-if="completedInSeconds">in {{ completedInSeconds }}s</span>.
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Transfer } from '@/actions/transfers';

const props = defineProps({
  transfer: Transfer,
});

const completedInSeconds = computed(() => {
  const createdTimestamp = props.transfer?.requestInformation?.timestamp;
  const filledTimestamp = props.transfer?.requestFulfillment?.timestamp;

  if (createdTimestamp && filledTimestamp) {
    return filledTimestamp - createdTimestamp;
  }
  return undefined;
});
</script>
