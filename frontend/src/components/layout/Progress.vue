<template>
  <ul>
    <li
      v-for="step in steps"
      :key="step.label"
      :class="{ completed: step.completed, failed: step.failed, hasError: step.errorMessage }"
    >
      {{ step.label }}
      <WaitingDots v-if="step.active" />
      <span v-if="step.errorMessage" class="text-red"> <br />{{ step.errorMessage }} </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import WaitingDots from '@/components/layout/WaitingDots.vue';

interface Props {
  readonly steps: Array<{
    label: string;
    active?: boolean;
    completed?: boolean;
    failed?: boolean;
    errorMessage?: string;
  }>;
}

defineProps<Props>();
</script>

<style scoped>
/* 
Please note that the used numeric values here are based on `rem` to scale with
the application, but are very fixed an not variable. If any of these value gets
touched, it is likely to break somewhere else. Using variables and calculation
only barely helps with this problem. As this is a very specialized custom
component, this inflexibility can be tolerated for now.
*/

li {
  @apply relative my-5 pl-10;
}

li::before {
  content: '';
  @apply absolute left-0 rounded-full w-7 h-7 text-center border-[2px] border-teal;
}

li.completed::before {
  @apply bg-green;
}

li.failed::before {
  @apply bg-red;
}

li:not(:last-of-type)::after {
  content: '';
  @apply absolute left-[0.8rem] border-teal border-[1px] top-[1.7rem] h-[1.45rem];
}

li.hasError::after {
  @apply h-[3.2rem];
}
</style>
