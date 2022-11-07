<template>
  <input
    ref="inputElement"
    v-focusOnMount="focusOnMount"
    data-test="input"
    :value="modelValue"
    :class="classes"
    @input="handleInput"
  />
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';

import { vFocusOnMount } from '@/directives/vFocusOnMount';

interface Props {
  modelValue: string;
  focusOnMount?: boolean;
  valid?: boolean;
  alignRight?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  valid: true,
  alignRight: false,
});

const emits = defineEmits<Emits>();

const updateValue = (value: string) => {
  emits('update:modelValue', value);
};

const handleInput = (event: Event) => {
  updateValue((event.target as HTMLInputElement).value);
};

const inputClasses = `h-18 w-full px-8 rounded-xl bg-sea-green shadow-inner
  text-2xl outline-none placeholder:opacity-25 placeholder:text-black
  disabled:text-sea-green disabled:bg-transparent disabled:border-2
  disabled:border-sea-green disabled:placeholder:text-sea-green`;
// Overrides the color manipulation behavior of browsers when input is in autofill mode
const autofillColorOverlayClasses = `
autofill:shadow-autofill autofill:shadow-sea-green autofill:bg-sea-green filter-none
`;

const inputComputedClasses = computed(() => [
  props.valid ? 'text-teal' : `text-red`,
  props.alignRight ? 'text-right' : 'text-left',
]);
const classes = computed(() => [
  inputClasses,
  autofillColorOverlayClasses,
  inputComputedClasses.value,
]);

const inputElement = ref<HTMLInputElement | null>(null);

defineExpose({
  inputElement,
});
</script>

<style scoped>
/* Removal of browsers default input controls (+/-) */
/* Chrome, Safari, Edge, Opera */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
