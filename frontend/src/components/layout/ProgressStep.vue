<template>
  <div data-content="" class="step relative !min-h-[4rem]" :class="stepClasses">
    <div class="absolute left-20 text-left" :class="contentClasses">
      {{ label }}
      <span v-if="errorMessage" class="text-red"> <br />{{ errorMessage }} </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  readonly label: string;
  readonly completed?: boolean;
  readonly failed?: boolean;
  readonly errorMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  completed: false,
  failed: false,
  errorMessage: undefined,
});

const stepClasses = computed(() => ({
  'step--completed': props.completed && !props.failed,
  'step--failed': props.failed,
}));

const contentClasses = computed(() => ({
  'top-4': props.errorMessage,
}));
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
  @apply border-teal bg-red;
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
