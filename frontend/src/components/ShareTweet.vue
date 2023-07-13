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

  const defaultText = `I just used @beamerbridge to seamlessly and securely transfer #${sourceToken.symbol} from ${sourceChain.name} to ${targetChain.name} in ${transferTime} seconds! 🔥

Unlock lightning-fast and secure bridging with Beamer today 💪💫 and don't miss out on Beamer's #layerupfest! #beam2L2

https://app.beamerbridge.com/
`;

  const subsidizedTransferText = `Unbelievable! @beamerbridge just unlocked 🦓 - it won't last, so don't miss out! 👀

Sent #${sourceToken.symbol} from ${sourceChain.name} to ${targetChain.name} securely in ${transferTime} seconds using 🦓. You can do it too! 🔥

Get lightning-fast and secure bridging with Beamer now 💪💫
https://app.beamerbridge.com/
`;

  if (isSubsidizedTransfer(transfer.value) && transfer.value.fees.uint256.isZero()) {
    return subsidizedTransferText;
  }
  return defaultText;
});

const shareUrl = computed(
  () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText.value)}`,
);
</script>
