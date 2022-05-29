<!-- Wrapper around vue-select for use with FormKit -->

<template>
  <v-select
    :id="props.context.id"
    :class="props.context.classes.input"
    class="selector"
    :options="props.context.options"
    label="label"
    :model-value="props.context._value"
    :clearable="false"
    :name="props.context.node.name"
    :disabled="props.context.disabled"
    :="props.context.attrs"
    @update:model-value="(value) => props.context.node.input(value)"
    @blur="props.context.handlers.blur()"
  >
    <template
      v-for="slotName in ['option', 'selected-option']"
      :key="slotName"
      #[slotName]="option: SelectorOption<unknown>"
    >
      <img v-if="option.imageUrl" class="vs__option-image" :src="option.imageUrl" />
      <span>{{ option.label }}</span>
    </template>

    <template #open-indicator="{ attributes }">
      <svg v-bind="attributes" class="w-4 h-4" viewBox="0 0 21 9">
        <path d="M20.9521 0H0.452148L10.4521 8.5L20.9521 0Z" />
      </svg>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import type { FormKitFrameworkContext } from '@formkit/core';
import vSelect from 'vue-select';

import type { SelectorOption } from '@/types/form';

interface SelectorContext extends FormKitFrameworkContext {
  options: Array<SelectorOption<unknown>>;
}

interface Props {
  readonly context: SelectorContext;
}

const props = defineProps<Props>();
</script>

<style lang="css">
.selector .vs__dropdown-toggle {
  @apply h-18 p-0 rounded-xl border-0 bg-teal-light shadow-inner transition-all;
}

.selector.vs--open .vs__dropdown-toggle {
  @apply rounded-t-xl rounded-b-none;
}

.selector .vs__dropdown-menu {
  @apply p-0 rounded-b-xl border-0 bg-teal-light shadow-inner-bottom min-w-fit;
}

.selector .vs__dropdown-option,
.selector .vs__selected,
.selector.vs--open .vs__search {
  @apply h-18 w-full m-0 pl-8 py-3 border-0 text-2xl text-teal flex flex-row gap-2 items-center overflow-hidden text-left;
}

.selector .vs__search {
  @apply mt-0 pl-8 border-0 text-2xl text-teal;
}

.selector .vs__dropdown-option {
  @apply px-8;
}

.selector .vs__dropdown-option--highlight {
  @apply bg-teal-very-light;
}

.selector .vs__selected-options {
  @apply p-0 m-0 flex-nowrap;
}

.selector .vs__option-image {
  @apply h-full;
}

.selector .vs__search::placeholder {
  @apply opacity-25 text-black text-left pl-8;
}

.selector .vs__no-options {
  @apply h-18 m-0 px-1 py-3 border-0 text-sm text-teal overflow-hidden;
}

.selector .vs__actions {
  @apply py-0 pr-5 pl-[6px] pt-1;
}

.selector .vs__open-indicator {
  @apply fill-teal;
}

.selector .vs__fade-enter-active,
.selector .vs__fade-leave-active {
  @apply transition-all;
}

.selector .vs__fade-enter-from,
.selector .vs__fade-leave-to {
  @apply rounded-xl opacity-0;
}
</style>
