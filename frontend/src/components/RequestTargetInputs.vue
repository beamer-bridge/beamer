<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3">
      <span class="pl-2 text-xl">To</span>
      <Selector
        v-model="selectedTargetChain"
        label="To"
        name="targetChain"
        :options="chainOptions"
        placeholder="Target Rollup"
        required
        @opened="hideActionButton"
        @closed="showActionButton"
      />
    </div>
    <div class="flex flex-row gap-5">
      <div class="flex flex-[9_9_0%] flex-col items-end">
        <BasicInput :model-value="props.amount" placeholder="0.00" type="text" disabled />
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
        <BasicInput
          v-model="selectedTargetAddress"
          name="toAddress"
          type="text"
          placeholder="Target Address"
          required
          :align-right="true"
          :valid="!v$.selectedTargetAddress.$error"
        />
        <InputValidationMessage class="text-right">
          <!-- Nasty temporary solution until containers are refactored to support flexible height -->
          <div v-if="v$.selectedTargetAddress.$errors.length">
            {{ v$.selectedTargetAddress.$errors[0].$message }}
          </div>
          <div v-else-if="showSafeSameTargetWarning" class="text-orange">
            Make sure you own a Safe with this address on the destination chain.
          </div>
          <div v-else>&nbsp;</div>
        </InputValidationMessage>
        <Transition>
          <div
            v-if="selectedTargetAddress && !v$.selectedTargetAddress.$error"
            class="checkmark absolute -right-5 -top-0 text-[22px] text-green after:content-['\2713']"
          ></div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, toRef, watch } from 'vue';

import BasicInput from '@/components/inputs/BasicInput.vue';
import Selector from '@/components/inputs/Selector.vue';
import InputValidationMessage from '@/components/layout/InputValidationMessage.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useRequestTargetInputValidations } from '@/composables/useRequestTargetInputValidations';
import { SafeProvider } from '@/services/web3-provider';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { usePortals } from '@/stores/portals';
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
const ethereumProvider = useEthereumWallet();
const { hideActionButton, showActionButton } = usePortals();

const { provider, signerAddress } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const selectedTargetChain = ref<SelectorOption<Chain> | null>(props.modelValue.targetChain);
const selectedTargetAddress = ref(props.modelValue.toAddress);

const ignoreChains = computed(() =>
  process.env.NODE_ENV === 'development' || !props.sourceChain ? [] : [props.sourceChain.value],
);
const { chainOptions } = useChainSelection(chains, ignoreChains);

const showSafeSameTargetWarning = computed(
  () =>
    provider.value instanceof SafeProvider && signerAddress.value === selectedTargetAddress.value,
);

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

const v$ = useRequestTargetInputValidations({
  selectedTargetChain,
  selectedTargetAddress,
  sourceChain: toRef(props, 'sourceChain'),
});

defineExpose({ v$ });

watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
