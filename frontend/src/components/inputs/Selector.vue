<template>
  <div :class="selectorClasses" v-bind="$attrs" data-test="open-trigger" @click="openSelector">
    <span v-if="modelValue === null" :class="placeholderClasses">{{ placeholder }}</span>
    <template v-else>
      <img v-if="modelValue.imageUrl" class="h-12" :src="modelValue.imageUrl" />
      <div class="flex-1"></div>
      <span>{{ modelValue.label }}</span>
    </template>

    <img src="@/assets/images/caret-down.svg" class="h-[1.5rem] w-[1.5rem] ml-5" />
  </div>

  <Transition>
    <div v-if="opened" :class="selectionOverlayClasses" data-test="option-list">
      <span class="text-3xl">{{ label }}</span>
      <TextInput
        v-model="searchFilter"
        name="searchFilter"
        placeholder="Search"
        :focus-on-mount="true"
        class="flex-[0_0_4.5rem]"
        data-test="search-field"
      />
      <div
        class="flex flex-col gap-5 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar"
      >
        <div
          v-for="option in filteredOptions"
          :key="option.label"
          :class="optionClasses"
          data-test="option"
          @click="selectOption(option)"
        >
          <img v-if="option.imageUrl" class="h-12" :src="option.imageUrl" />
          <span>{{ option.label }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import TextInput from '@/components/inputs/TextInput.vue';
import type { SelectorOption } from '@/types/form';

interface Props {
  modelValue: SelectorOption<unknown> | null;
  readonly options: SelectorOption<unknown>[];
  readonly placeholder: string;
  readonly disabled?: boolean;
  readonly label?: string;
}

interface Emits {
  (e: 'update:modelValue', value: SelectorOption<unknown>): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const opened = ref(false);
const openSelector = () => {
  if (!props.disabled) {
    opened.value = true;
  }
};
const closeSelector = () => (opened.value = false);

const searchFilter = ref('');
const filteredOptions = computed(() =>
  props.options.filter((option) =>
    option.label.toLowerCase().includes(searchFilter.value.toLowerCase()),
  ),
);

const selectOption = (option: SelectorOption<unknown>) => {
  emits('update:modelValue', option);
  closeSelector();
};

const selectorConditionalClasses = computed(() =>
  props.disabled
    ? 'text-teal-light bg-transparent border-2 border-teal-light cursor-default'
    : 'text-teal bg-teal-light cursor-text',
);
const selectorClasses = computed(
  () => `flex flex-row items-center justify-end 
  h-18 w-full px-8 rounded-xl shadow-inner 
  text-2xl text-right ${selectorConditionalClasses.value}`,
);
const placeholderClasses = computed(() => `opacity-25 ${props.disabled ? '' : ' text-black'}`);
const selectionOverlayClasses = `absolute top-0 bottom-0 right-0 left-0
  bg-teal z-20 rounded-b-lg px-16 py-10 
  flex flex-col gap-5 
`;
const optionClasses = `flex flex-row items-center gap-8 cursor-pointer 
  flex-[0_0_4.5rem] w-full px-8 rounded-xl border border-teal-light text-mint text-2xl
  hover:border-teal-dark hover:bg-teal-dark
`;
</script>
