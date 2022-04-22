<template>
  <li data-content="" class="step" :class="classObject">
    {{ label }}
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  readonly label: string;
  readonly completed?: boolean;
  readonly failed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  completed: false,
  failed: false,
});

const classObject = computed(() => {
  return {
    'step--completed': props.completed && !props.failed,
    'step--failed': props.failed,
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
.steps .step--completed:after {
  @apply border-teal bg-green;
  border-width: 2px;
}
.steps .step--completed + .step--completed:before {
  @apply bg-light;
}
.steps .step--failed:after {
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
