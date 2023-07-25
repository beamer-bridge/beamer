<template>
  <template v-if="isShareable">
    <a data-test="cta" :href="shareUrl" target="_blank" class="underline"> Share via twitter</a>
  </template>
</template>

<script lang="ts" setup>
import { computed, toRef } from 'vue';

import { isSubsidizedTransfer, Transfer } from '@/actions/transfers';

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
  if (!transfer.value) {
    return '';
  }
  const sourceToken = transfer.value.sourceAmount.token;
  const sourceChain = transfer.value.sourceChain;
  const targetChain = transfer.value.targetChain;
  const transferTime = transfer.value.transferTimeSeconds;

  let defaultTextExtension = 'using @beamerbridge';
  if (isSubsidizedTransfer(transfer.value) && transfer.value.fees.uint256.isZero()) {
    defaultTextExtension = 'and with 0 fees using @beamerbridge';
  }

  const defaultText = `Unbelievable! I sent #${sourceToken.symbol} from ${sourceChain.name} to ${targetChain.name} in just ${transferTime} seconds ${defaultTextExtension}! 🔥

Hit the volume threshold and enjoy, because it won't last! 👀🦓  

Now also live on Polygon zkEVM! 💪💫
https://app.beamerbridge.com/`;

  return defaultText;
});

const shareUrl = computed(
  () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText.value)}`,
);
</script>
