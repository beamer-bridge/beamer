<template>
  <input
    :value="modelValue"
    type="text"
    class="h-18 w-full px-8 rounded-xl bg-teal-light shadow-inner text-teal text-2xl text-left placeholder:opacity-25 placeholder:text-black"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>
