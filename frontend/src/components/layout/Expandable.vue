<template>
  <div ref="element" class="relative flex flex-col">
    <img :src="buttonImage" class="absolute top-6 left-6 h-[1.5rem] w-[1.5rem]" />

    <div class="cursor-pointer" data-test="header" @click="toggleBodyVisibility">
      <slot name="header" />
    </div>

    <div v-if="bodyIsVisible" data-test="body">
      <slot name="body" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import CaretDown from '@/assets/images/caret-down.svg';
import CaretRight from '@/assets/images/caret-right.svg';

interface Props {
  isExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
});

const element = ref<HTMLElement>();
const bodyIsVisible = ref(false);
const buttonImage = computed(() => (bodyIsVisible.value ? CaretDown : CaretRight));

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
