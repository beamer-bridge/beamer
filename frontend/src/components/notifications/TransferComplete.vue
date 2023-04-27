<template>
  <div>
    <span data-test="message">
      <span v-if="transfer?.transferTime !== undefined"
        >Transfer completed in {{ transfer?.transferTime }}s.</span
      >
      <span v-else> Transfer completed. </span>
    </span>
    <br />
    <ShareTweet :transfer="transfer"></ShareTweet>
  </div>
</template>

<script setup lang="ts">
import { Transfer } from '@/actions/transfers';
import ShareTweet from '@/components/ShareTweet.vue';

defineProps({
  transfer: Transfer,
});
</script>
