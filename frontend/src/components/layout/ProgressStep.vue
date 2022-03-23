<template>
  <li data-content="" class="step" :class="classObject">
    <slot></slot>
  </li>
</template>

<script setup lang="ts">
import { computed, defineProps } from 'vue';

import { RequestState } from '@/types/data';

interface Props {
  readonly currentState: RequestState;
  readonly triggerState: RequestState;
  readonly warnState?: RequestState;
}
const props = defineProps<Props>();

const classObject = computed(() => {
  var showWarning = false;
  var showSuccess = false;

  const state = props.currentState;
  if (state) {
    if (props.warnState) {
      showWarning = state === props.warnState;
    }
    showSuccess = !showWarning && state >= props.triggerState;
  }

  const obj = {
    'step-warning': showWarning,
    'step-success': showSuccess,
  };
  return obj;
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
.steps-vertical .step:before {
  width: 0.2rem;
}
.steps-vertical .step {
  gap: 1.5rem;
  min-height: 5rem;;
}
</style>
