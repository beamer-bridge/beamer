<template>
  <input
    ref="textElement"
    :value="modelValue"
    type="text"
    :class="inputClasses"
    @input="updateValue"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Props {
  modelValue: string;
  focusOnMount?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
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

const inputClasses = `h-18 w-full px-8 rounded-xl bg-teal-light shadow-inner text-teal 
  text-2xl text-left outline-none placeholder:opacity-25 placeholder:text-black 
  disabled:text-teal-light disabled:bg-transparent disabled:border-2 
  disabled:border-teal-light disabled:placeholder:text-teal-light`;
</script>
