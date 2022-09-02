<template>
  <div ref="element" :style="miniumHeightStyle">
    <slot v-if="isVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, unref } from 'vue';

interface Props {
  minimumHeight?: number;
  rootElement?: HTMLElement | null;
  rootMargin?: string;
  threshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  minimumHeight: 20,
  rootElement: undefined,
  rootMargin: '60px',
  threshold: 0.5,
});

const observerAvailable = window && 'IntersectionObserver' in window;
const observer = ref<IntersectionObserver | undefined>(undefined);
const element = ref();
const isVisible = ref(!observerAvailable);
const minimumHeight = ref(0);
const miniumHeightStyle = computed(() => ({
  'min-height': `${minimumHeight.value}px`,
}));

function onIntersectionChange(entries: Array<{ isIntersecting: boolean }>) {
  isVisible.value = entries[0].isIntersecting;
  minimumHeight.value = isVisible.value ? props.minimumHeight : element.value?.clientHeight;
}

onMounted(async () => {
  // Waiting for dom updates to finish so element.clientHeight is set properly
  // nextTick() was not working
  await new Promise((r) => setTimeout(r, 1));

  if (observerAvailable) {
    const { rootElement: root, rootMargin, threshold } = props;

    observer.value = new window.IntersectionObserver(onIntersectionChange, {
      root,
      rootMargin,
      threshold,
    });

    observer.value.observe(unref(element.value));
  }
});

onUnmounted(() => {
  observer.value?.disconnect();
});
</script>
