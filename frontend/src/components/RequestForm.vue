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

<script lang="ts">
import { BigNumber } from 'ethers';
import { Options } from 'vue-class-component';
import { Emit, Prop, Vue } from 'vue-property-decorator';

import Spinner from '@/components/Spinner.vue';

export type RequestFormResult = {
  targetChainId: BigNumber;
  sourceTokenAddress: string;
  targetTokenAddress: string;
  targetAddress: string;
  amount: BigNumber;
};

@Options({
  components: {
    Spinner,
  },
})
export default class RequestForm extends Vue {
  @Prop(Boolean)
  readonly loading!: boolean;

  targetChainId = '';
  sourceTokenAddress = '';
  targetTokenAddress = '';
  targetAddress = '';
  amount = '';

  get emptyInput(): boolean {
    return (
      !this.targetChainId ||
      !this.sourceTokenAddress ||
      !this.targetTokenAddress ||
      !this.targetAddress ||
      !this.amount
    );
  }

  @Emit('formAccepted')
  emitFormAccepted(): RequestFormResult {
    return {
      targetChainId: BigNumber.from(this.targetChainId),
      sourceTokenAddress: this.sourceTokenAddress,
      targetTokenAddress: this.targetTokenAddress,
      targetAddress: this.targetAddress,
      amount: BigNumber.from(this.amount),
    };
  }
}
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
    background-color: $dark-background-color;
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
