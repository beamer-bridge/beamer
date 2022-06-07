<template>
  <span>{{ currentFrame }}</span>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const frameSequence = ['\xa0\xa0\xa0', '.\xa0\xa0', '..\xa0', '...'];
const currentFrameIndex = ref(0);
const timer = ref<ReturnType<typeof setInterval> | undefined>(undefined);

const currentFrame = computed(() => frameSequence[currentFrameIndex.value]);

function nextFrame() {
  let nextIndex = currentFrameIndex.value + 1;
  nextIndex = nextIndex >= frameSequence.length ? 0 : nextIndex;
  currentFrameIndex.value = nextIndex;
}

onMounted(() => {
  timer.value = setInterval(nextFrame, 500);
});

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});
</script>
