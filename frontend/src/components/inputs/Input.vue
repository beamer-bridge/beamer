<template>
  <input
    ref="textElement"
    data-test="input"
    v-bind="{ type }"
    :value="modelValue"
    :class="inputClasses"
    @input="updateValue"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Props {
  modelValue: string;
  focusOnMount?: boolean;
  type?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
});

const emits = defineEmits<Emits>();

const updateValue = (event: Event) => {
  emits('update:modelValue', (event.target as HTMLInputElement).value);
};

const textElement = ref<HTMLElement>();
onMounted(() => {
  if (props.focusOnMount && textElement.value) {
    textElement.value.focus();
  }
});

const inputClasses = `h-18 w-full px-8 rounded-xl bg-sea-green shadow-inner text-teal 
  text-2xl text-right outline-none placeholder:opacity-25 placeholder:text-black 
  disabled:text-sea-green disabled:bg-transparent disabled:border-2 
  disabled:border-sea-green disabled:placeholder:text-sea-green`;
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
