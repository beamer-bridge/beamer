<template>
  <div ref="element" class="flex flex-col">
    <div
      class="flex cursor-pointer justify-between"
      data-test="header"
      @click="toggleBodyVisibility"
    >
      <div class="flex w-5 items-center">
        <img :src="CaretRight" class="top-4 left-4 h-[1rem] w-[1rem]" :class="caretClasses" />
      </div>

      <slot name="header" />
    </div>

    <div v-if="bodyIsVisible" data-test="body">
      <slot name="body" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import CaretRight from '@/assets/images/caret-right.svg';

interface Props {
  isExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
});

const element = ref<HTMLElement>();
const bodyIsVisible = ref(false);
const caretClasses = computed(() => (bodyIsVisible.value ? 'rotate-90' : 'rotate-0'));

function toggleBodyVisibility(): void {
  bodyIsVisible.value = !bodyIsVisible.value;
}

watch(
  () => props.isExpanded,
  () => {
    bodyIsVisible.value = props.isExpanded;
  },
  { immediate: true },
);

watch(bodyIsVisible, (visible) => {
  if (visible) {
    element.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
</script>
