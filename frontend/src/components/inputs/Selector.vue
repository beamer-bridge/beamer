<!-- Wrapper around vue-select for use with FormKit -->

<template>
  <v-select
    :id="props.context.id"
    :class="props.context.classes.input"
    class="selector"
    :options="props.context.options"
    label="label"
    :clearable="false"
    :name="props.context.node.name"
    :disabled="props.context.disabled"
    :="props.context.attrs"
    @blur="props.context.handlers.blur()"
  >
    <template
      v-for="slotName in ['option', 'selected-option']"
      :key="slotName"
      #[slotName]="option: SelectorOption"
    >
      <img v-if="option.imageUrl" class="vs__option-image" :src="option.imageUrl" />
      <span>{{ option.label }}</span>
    </template>

    <template #open-indicator="{ attributes }">
      <svg v-bind="attributes" width="22" height="9" viewBox="0 0 21 9">
        <path d="M20.9521 0H0.452148L10.4521 8.5L20.9521 0Z" />
      </svg>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { FormKitFrameworkContext } from '@formkit/core';
import vSelect from 'vue-select';

import type { SelectorOption } from '@/types/form';

interface SelectorContext extends FormKitFrameworkContext {
  options: Array<SelectorOption>;
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
  @apply p-0 rounded-b-xl border-0 bg-teal-light shadow-inner-bottom;
}

.selector .vs__dropdown-option,
.selector .vs__selected,
.selector .vs__search {
  @apply h-18 w-full m-0 pl-4 py-3 border-0 text-2xl text-teal flex flex-row gap-2 items-center justify-between overflow-hidden;
}

.selector .vs__selected,
.selector .vs__search {
  @apply pr-[2px];
}

.selector .vs__dropdown-option {
  @apply pr-8;
}

.selector .vs__dropdown-option--highlight {
  @apply bg-teal-very-light;
}

.selector .vs__selected-options {
  @apply p-0 m-0;
}

.selector .vs__option-image {
  @apply h-full;
}

.selector .vs__search::placeholder {
  @apply opacity-25 text-black text-right;
}

.selector .vs__no-options {
  @apply h-18 m-0 px-1 py-3 border-0 text-lg text-teal overflow-hidden;
}

.selector .vs__actions {
  @apply py-0 px-1;
}

.selector .vs__open-indicator {
  @apply fill-teal;
}

.selector .vs__fade-enter-active,
.selector .vs__fade-leave-active {
  @apply transition-all;
}

.selector .vs__fade-enter,
.selector .vs__fade-leave-to {
  @apply rounded-xl;
}
</style>
