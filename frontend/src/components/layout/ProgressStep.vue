<template>
  <li data-content="" class="step" :class="classObject">
    <slot></slot>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { RequestState } from '@/types/data';

interface Props {
  readonly currentState: RequestState;
  readonly triggerState: RequestState;
  readonly warnState?: RequestState;
}

const props = defineProps<Props>();

const classObject = computed(() => {
  const { currentState, triggerState, warnState } = props;
  const showWarning = currentState === warnState;
  const showSuccess = !showWarning && currentState >= triggerState;

  return {
    'step-warning': showWarning,
    'step-success': showSuccess,
  };
});
</script>

<style lang="css">
.steps .step:before {
  @apply bg-light;
}
.steps .step:after {
  @apply border-light bg-teal;
  height: 1.5rem;
  width: 1.5rem;
  border-width: 2px;
}
.steps .step-success:after {
  @apply border-teal bg-green;
  border-width: 2px;
}
.steps .step-success + .step-success:before {
  @apply bg-light;
}
.steps .step-warning:after {
  @apply border-teal bg-orange-dark;
  border-width: 2px;
}
.steps-vertical .step:before {
  width: 0.2rem;
}
.steps-vertical .step {
  gap: 1.5rem;
  min-height: 5rem;
}
</style>
