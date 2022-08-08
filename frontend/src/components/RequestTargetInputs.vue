<template>
  <div class="flex flex-col gap-7">
    <div class="flex flex-col gap-5">
      <span class="text-3xl">To</span>
      <Selector
        v-model="selectedTargetChain"
        label="To"
        name="targetChain"
        :options="chainOptions"
        placeholder="Target Rollup"
        required
      />
    </div>
    <div class="flex flex-row gap-5">
      <div class="flex-[9_9_0%] flex flex-col items-end">
        <Input :model-value="props.amount" placeholder="0.00" type="number" disabled />
      </div>
      <div class="flex-[7_7_0%]">
        <Selector
          id="token"
          :model-value="props.token"
          :options="[]"
          placeholder="Token"
          :disabled="true"
        />
      </div>
    </div>
    <div class="flex flex-col items-end">
      <div class="relative w-full items-end">
        <Input
          v-model="selectedTargetAddress"
          name="toAddress"
          type="text"
          placeholder="Target Address"
          required
          :align-right="true"
          :valid="!v$.toAddress.$error"
        />
        <InputErrorMessage class="text-right">
          <!-- Nasty temporary solution until containers are refactored to support flexible height -->
          <div v-if="v$.toAddress.$errors.length">
            {{ v$.toAddress.$errors[0].$message }}
          </div>
          <div v-else>&nbsp;</div>
        </InputErrorMessage>
        <Transition>
          <div
            v-if="!v$.toAddress.$error"
            class="checkmark after:content-['\2713'] absolute -right-14 -top-2 2xl:-right-11 2xl:top-1 text-[30px] text-green"
          ></div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core';
import { helpers, required } from '@vuelidate/validators';
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';

import Input from '@/components/inputs/Input.vue';
import Selector from '@/components/inputs/Selector.vue';
import InputErrorMessage from '@/components/layout/InputValidationMessage.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useConfiguration } from '@/stores/configuration';
import type { Chain, Token } from '@/types/data';
import type { RequestTarget, SelectorOption } from '@/types/form';
import { isValidEthAddress, notSameAsChain } from '@/validation/validators';

interface Props {
  modelValue: RequestTarget;
  amount: string;
  sourceChain: SelectorOption<Chain> | null;
  token: SelectorOption<Token> | null;
}

interface Emits {
  (e: 'update:modelValue', value: RequestTarget): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const configuration = useConfiguration();

const { chains } = storeToRefs(configuration);

const selectedTargetChain = ref<SelectorOption<Chain> | null>(props.modelValue.targetChain);
const selectedTargetAddress = ref(props.modelValue.toAddress);

const ignoreChains = computed(() =>
  process.env.NODE_ENV === 'development' || !props.sourceChain ? [] : [props.sourceChain.value],
);
const { chainOptions } = useChainSelection(chains, ignoreChains);

watch(
  () => props.sourceChain,
  (newSourceChain) => {
    if (newSourceChain?.value.identifier === selectedTargetChain.value?.value.identifier) {
      selectedTargetChain.value = null;
    }
  },
);

const inputValues: WritableComputedRef<RequestTarget> = computed({
  get: () => ({
    targetChain: selectedTargetChain.value,
    toAddress: selectedTargetAddress.value,
  }),
  set: (formValues: RequestTarget) => {
    selectedTargetChain.value = formValues.targetChain;
    selectedTargetAddress.value = formValues.toAddress;
  },
});

const computedRules = computed(() => {
  const toAddressRules = {
    $autoDirty: true,
    required: helpers.withMessage('Destination address is required', required),
    isValidEthAddress: helpers.withMessage('Invalid ETH address', isValidEthAddress),
  };
  const targetChainRules = {
    $autoDirty: true,
    required,
  };

  if (selectedTargetChain.value && props.sourceChain?.value) {
    const sourceChainTemporary = props.sourceChain.value;
    return {
      targetChain: {
        ...targetChainRules,
        notSameAsSourceChain: (chain: SelectorOption<Chain>) =>
          notSameAsChain(sourceChainTemporary)(chain?.value),
      },
      toAddress: toAddressRules,
    };
  }

  return {
    targetChain: targetChainRules,
    toAddress: toAddressRules,
  };
});

const state = {
  targetChain: selectedTargetChain,
  toAddress: selectedTargetAddress,
};

const v$ = useVuelidate(computedRules, state);

defineExpose({ v$ });

watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
<style></style>
