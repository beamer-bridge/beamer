<template>
  <div class="text-center">
    <template v-if="!withdrawn">
      <template v-if="!withdrawInProgress">
        <Tooltip v-if="!withdrawable" show-outside-of-closest-reference-element class="text-left">
          <template #hint>
            <span data-test="dispute-description">
              Someone claimed that the request has been filled on your destination rollup.
              <br />
              If you have not received any funds as expected, you will be able to withdraw your
              tokens here. <br />
              Please, wait until the claim dispute has been resolved. Please note, that this can
              take up to several days.
            </span>
          </template>
          <span data-test="dispute-message">Waiting for dispute resolution </span>
          <WaitingDots />
        </Tooltip>
        <button
          v-else
          class="underline text-red hover:opacity-90"
          data-test="recover-tokens-button"
          @click="emitWithdraw"
        >
          Recover Tokens
        </button>
      </template>
      <Spinner v-else size-classes="w-6 h-6" border="2" class="border-t-teal" />
    </template>
    <div v-else class="text-green">Tokens Withdrawn</div>

    <span v-if="errorMessage" class="text-red"><br />{{ errorMessage }}</span>
  </div>
</template>

<script setup lang="ts">
import Spinner from '@/components/Spinner.vue';

import Tooltip from './layout/Tooltip.vue';
import WaitingDots from './layout/WaitingDots.vue';

interface Props {
  withdrawn: boolean;
  withdrawable: boolean;
  withdrawInProgress: boolean;
  errorMessage?: string;
}

interface Emits {
  (event: 'withdraw'): void;
}

defineProps<Props>();
const emits = defineEmits<Emits>();

function emitWithdraw(): void {
  emits('withdraw');
}
</script>
