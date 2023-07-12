<template>
  <template v-if="isShareable">
    <a data-test="cta" :href="shareUrl" target="_blank" class="underline"> Share via twitter</a>
  </template>
</template>

<script lang="ts" setup>
import { computed, toRef } from 'vue';

import { Transfer } from '@/actions/transfers';

const props = defineProps({
  transfer: Transfer,
});
const transfer = toRef(props, 'transfer');

const isShareable = computed(() => {
  return (
    !!transfer.value &&
    !!transfer.value.sourceAmount.token &&
    !!transfer.value.sourceChain &&
    !!transfer.value.targetChain &&
    !!transfer.value.transferTimeSeconds
  );
});

const tweetText = computed(() => {
  const sourceToken = transfer.value?.sourceAmount.token;
  const sourceChain = transfer.value?.sourceChain;
  const targetChain = transfer.value?.targetChain;
  const transferTime = transfer.value?.transferTimeSeconds;

  return `I just used @beamerbridge to seamlessly and securely transfer #${sourceToken?.symbol} from ${sourceChain?.name} to ${targetChain?.name} in ${transferTime} seconds! 🔥

Unlock lightning-fast and secure bridging with Beamer today 💪💫  Now also live on Polygon zkEVM!
https://app.beamerbridge.com/
`;
});

const shareUrl = computed(
  () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText.value)}`,
);
</script>
