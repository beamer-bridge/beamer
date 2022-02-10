<template>
  <div class="container request-form flex flex-col gap-10">
    <div class="flex flex-row gap-2 justify-start items-center">
      <div class="text-white">Send</div>
      <div>
        <input v-model="amount" class="request-form__input" placeholder="Token Amount" />
      </div>
      <div class="w-full">
        <Dropdown :list="tokens"></Dropdown>
      </div>
    </div>
    <div class="flex flex-col gap-2 justify-start items-start">
      <div class="text-white text-sm">From</div>
      <div class="w-full">
        <Dropdown :list="networks"></Dropdown>
      </div>
    </div>
    <div class="flex flex-col gap-2 justify-start items-start">
      <div class="text-white text-sm">To</div>
      <div class="w-full">
        <Dropdown :list="networks"></Dropdown>
      </div>
      <div class="w-full">
        <input v-model="targetAddress" class="request-form__input w-full" placeholder="address" />
      </div>
    </div>

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
      <template v-else> Connect Metamask Wallet </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { BigNumber } from 'ethers';
import { computed, ref } from 'vue';

import Dropdown from '@/components/Dropdown.vue';
import Spinner from '@/components/Spinner.vue';
import { RequestFormResult } from '@/types/form';

interface Props {
  readonly loading: boolean;
}
interface Emits {
  (e: 'form-accepted', formResult: RequestFormResult): void;
}

const tokens = [
  {
    id: 'USDC',
    name: 'USDC',
    icon: './assets/images/usdc.svg',
  },
  {
    id: 'DAI',
    name: 'DAI',
    icon: './assets/images/dai.svg',
  },
];

const networks = [
  { id: 'Optimism', name: 'Optimism', icon: './assets/images/usdc.svg' },
  { id: 'Polygon', name: 'Polygon', icon: './assets/images/usdc.svg' },
  { id: 'Arbitrum', name: 'Arbitrum', icon: './assets/images/usdc.svg' },
];

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
  emit('form-accepted', {
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
  &__input {
    border-radius: 51px;
    padding: 10px;
    color: $text-color-dark;
    background-color: $background-color-light;
    font-size: medium;

    &::placeholder {
      color: $placeholder-color;
    }
  }

  &__button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    font-size: 16px;
    line-height: 24px;
    margin-top: 8px;
    border-radius: 25px;
    padding: 10px 25px;
    color: $text-color-dark;
    box-shadow: 0px 3px 26px rgba(0, 0, 0, 0.16);
    background-color: $color-orange;
    cursor: pointer;

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }

    &:hover:enabled,
    &:active:enabled {
      background-color: $color-orange;
    }
  }

  &__spinner-container {
    width: 24px;
    height: 24px;
  }
}
</style>
