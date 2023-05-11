<template>
  <div>
    <span data-test="message">
      <div v-if="shareVisible">
        <div>Transfer completed in {{ transfer?.transferTimeSeconds }}s.</div>
        <ShareTweet :transfer="transfer"></ShareTweet>
      </div>
      <span v-else> Transfer completed. </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Transfer } from '@/actions/transfers';
import ShareTweet from '@/components/ShareTweet.vue';

const props = defineProps({
  transfer: Transfer,
});

const shareVisible = computed(
  () => props.transfer?.transferTimeSeconds && props.transfer.transferTimeSeconds < 120,
);
</script>
