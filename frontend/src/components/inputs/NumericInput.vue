<template>
  <BasicInput
    v-bind="{ ...$props, ...$attrs }"
    ref="baseInput"
    type="text"
    pattern="^[0-9]*[.,]?[0-9]*$"
    inputmode="decimal"
    autocomplete="off"
    autocorrect="off"
    placeholder="0.00"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

import BasicInput from '@/components/inputs/BasicInput.vue';

// TODO: use imported Props from BasicInput.vue on next Vue version bump
// (https://github.com/sxzz/unplugin-vue-macros/pull/126#issuecomment-1289544684)
export type Props = {
  modelValue: string;
  focusOnMount?: boolean;
  valid?: boolean;
  alignRight?: boolean;
};

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

defineProps<Props>();
const emits = defineEmits<Emits>();

const baseInput = ref<{ inputElement: HTMLInputElement } | null>(null);

const updateValue = (value: string) => {
  emits('update:modelValue', value);
};

const prevValue = ref('');

const handleInput = (event: Event) => {
  const nextUserInput = (event.target as HTMLInputElement).value.replace(/,/g, '.');
  if (nextUserInput === '' || inputRegex.test(escapeRegExp(nextUserInput))) {
    updateValue(nextUserInput);
    prevValue.value = nextUserInput;
  } else {
    if (baseInput.value) {
      baseInput.value.inputElement.value = prevValue.value;
    }
  }
};

const inputRegex = RegExp(`^\\d*(?:\\\\[.])?\\d*$`); // match escaped "." characters via in a non-capturing group

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
</script>
