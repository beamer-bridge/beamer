<template>
  <Teleport v-if="portalIsAvailable" :to="to">
    <slot />
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

interface Props {
  to: string;
}

const props = defineProps<Props>();
const portalIsAvailable = ref(false);
const observer = ref<MutationObserver | undefined>(undefined);
const timer = ref<ReturnType<typeof setInterval> | undefined>(undefined);

function checkForPortal(): void {
  portalIsAvailable.value = document.querySelector(props.to) !== null;
}

onMounted(() => {
  checkForPortal();

  if (!portalIsAvailable.value) {
    if (window && 'MutationObserver' in window && MutationObserver) {
      observer.value = new MutationObserver(checkForPortal);
      observer.value.observe(document.body, { childList: true, subtree: true });
    } else {
      timer.value = setInterval(checkForPortal, 500);
    }
  }
});

function clearObserverAndTimer(): void {
  if (observer.value) {
    observer.value.disconnect();
    observer.value = undefined;
  }

  if (timer.value) {
    clearInterval(timer.value);
    timer.value = undefined;
  }
}

watch(portalIsAvailable, () => {
  if (portalIsAvailable.value) {
    clearObserverAndTimer();
  }
});

onUnmounted(() => {
  clearObserverAndTimer();
});
</script>
