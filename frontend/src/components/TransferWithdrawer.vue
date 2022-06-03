<template>
  <div class="text-center">
    <template v-if="!withdrawn">
      <span
        v-if="!active"
        class="cursor-pointer underline text-red"
        data-test="recover-tokens-button"
        @click="emitWithdraw"
      >
        Recover Tokens
      </span>

      <Spinner v-if="active" class="border-t-teal h-6 w-6" />

      <span v-if="errorMessage" class="text-red"><br />{{ errorMessage }}</span>
    </template>

    <div v-else class="text-green">Tokens Withdrawn</div>
  </div>
</template>

<script setup lang="ts">
import Spinner from '@/components/Spinner.vue';

interface Props {
  withdrawn: boolean;
  active: boolean;
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
