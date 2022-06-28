<template>
  <input :value="modelValue" type="text" :class="inputClasses" @input="updateValue" />
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

defineProps<Props>();
const emits = defineEmits<Emits>();

const updateValue = (event: Event) => {
  emits('update:modelValue', (event.target as HTMLInputElement).value);
};

const inputClasses = `h-18 w-full px-8 rounded-xl bg-teal-light shadow-inner text-teal 
  text-2xl text-left placeholder:opacity-25 placeholder:text-black 
  disabled:text-teal-light disabled:bg-transparent disabled:border 
  disabled:border-teal-light disabled:placeholder:text-teal-light`;
</script>
