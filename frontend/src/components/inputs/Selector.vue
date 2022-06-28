<template>
  <div class="flex flex-col gap-5 items-stretch">
    <span v-if="label" class="text-3xl">{{ label }}</span>
    <v-select
      class="selector"
      :clearable="false"
      :options="options"
      v-bind="$attrs"
      @update:model-value="$attrs.onInput"
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
  </div>
</template>

<script setup lang="ts">
import vSelect from 'vue-select';

import type { SelectorOption } from '@/types/form';

interface Props {
  readonly options: SelectorOption<unknown>[];
  readonly label?: string;
}

defineProps<Props>();
</script>

<script lang="ts">
export default {
  // Necessary because the fallthrough attributes should not be attached to the root element of this component, but the inner v-select
  inheritAttrs: false,
};
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

.selector.vs--disabled .vs__search {
  background-color: inherit;
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

.selector.vs--disabled .vs__open-indicator {
  background-color: inherit;
}

.selector .vs__fade-enter-active,
.selector .vs__fade-leave-active {
  @apply transition-all;
}

.selector .vs__fade-enter-from,
.selector .vs__fade-leave-to {
  @apply rounded-xl opacity-0;
}

.selector.vs--disabled .vs__open-indicator,
.selector.vs--disabled .vs__search {
  @apply invisible;
}

.selector.vs--disabled .vs__selected {
  @apply text-teal-light;
}

.selector.vs--disabled .vs__dropdown-toggle {
  @apply bg-transparent border border-teal-light;
}
</style>
