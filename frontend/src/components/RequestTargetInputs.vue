<template>
  <div class="flex flex-col gap-7">
    <Selector
      v-model="selectedTargetChain"
      label="To"
      name="targetChain"
      :options="chainOptions"
      placeholder="Target Rollup"
      required
    />
    <div class="flex flex-row gap-5">
      <div class="flex-[3_3_0%] flex flex-col items-end">
        <TextInput :model-value="props.amount" placeholder="0.00" disabled />
      </div>
      <div class="flex-[2_2_0%]">
        <Selector
          id="token"
          :model-value="props.token"
          :options="[]"
          placeholder="Token"
          disabled
        />
      </div>
    </div>
    <TextInput
      v-model="selectedTargetAddress"
      name="toAddress"
      placeholder="Target Address"
      required
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';

import Selector from '@/components/inputs/Selector.vue';
import TextInput from '@/components/inputs/TextInput.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { Chain, Token } from '@/types/data';
import type { RequestTarget, SelectorOption } from '@/types/form';

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
const ethereumProvider = useEthereumProvider();

const { provider } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const selectedTargetChain = ref<SelectorOption<Chain> | null>(null);
const selectedTargetAddress = ref('');

const ignoreChains = computed(() =>
  process.env.NODE_ENV === 'development' || !props.sourceChain ? [] : [props.sourceChain.value],
);
const { chainOptions } = useChainSelection(provider, chains, ignoreChains);
watch(ignoreChains, console.log);

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

watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
