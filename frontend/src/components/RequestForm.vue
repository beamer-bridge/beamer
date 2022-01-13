<template>
  <div class="request-form">
    <input v-model="targetChainId" class="request-form__input" placeholder="Target Chain Id" />
    <input
      v-model="sourceTokenAddress"
      class="request-form__input"
      placeholder="Source Token Address"
    />
    <input
      v-model="targetTokenAddress"
      class="request-form__input"
      placeholder="Target Token Address"
    />
    <input v-model="targetAddress" class="request-form__input" placeholder="Target Address" />
    <input v-model="amount" class="request-form__input" placeholder="Token Amount" />
    <button
      class="request-form__button"
      :disabled="emptyInput || loading"
      @click="emitFormAccepted"
    >
      <template v-if="loading">
        <div class="request-form__spinner-container">
          <spinner></spinner>
        </div>
      </template>
      <template v-else> Request </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { BigNumber } from 'ethers';
import { computed, ref } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { RequestFormResult } from '@/types/form';

interface Props {
  readonly loading: boolean;
}
interface Emits {
  (e: 'formAccepted', formResult: RequestFormResult): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const targetChainId = ref('');
const sourceTokenAddress = ref('');
const targetTokenAddress = ref('');
const targetAddress = ref('');
const amount = ref('');

const emptyInput = computed(
  () =>
    !targetChainId.value ||
    !sourceTokenAddress.value ||
    !targetTokenAddress.value ||
    !targetAddress.value ||
    !amount.value,
);

const emitFormAccepted = () =>
  emit('formAccepted', {
    targetChainId: BigNumber.from(targetChainId.value),
    sourceTokenAddress: sourceTokenAddress.value,
    targetTokenAddress: targetTokenAddress.value,
    targetAddress: targetAddress.value,
    amount: BigNumber.from(amount.value),
  });
</script>

<style scoped lang="scss">
@import '@/scss/colors';

.request-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;

  &__input {
    border-radius: 10px;
    padding: 10px;
    color: $text-color-light;
    background-color: $background-color-dark;
    height: 40px;
    margin-bottom: 16px;

    &::placeholder {
      color: $placeholder-color;
    }
  }

  &__button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    font-size: 18px;
    line-height: 24px;
    margin-top: 8px;
    border-radius: 25px;
    padding: 10px 25px;
    width: 150px;
    color: $text-color;
    background-color: $primary;
    cursor: pointer;

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }

    &:hover:enabled,
    &:active:enabled {
      background-color: $primary-light;
    }
  }

  &__spinner-container {
    width: 24px;
    height: 24px;
  }
}
</style>
