<template>
  <ul>
    <li
      v-for="step in steps"
      :key="step.label"
      :class="{ completed: step.completed, failed: step.failed, hasError: step.errorMessage }"
    >
      {{ step.label }}
      <WaitingDots v-if="step.active" />
      <span v-if="step.errorMessage" class="error-message text-red">
        <br />{{ step.errorMessage }}
      </span>
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

<style lang="scss" scoped>
/*
Please note that the used numeric values here are based on `rem` to scale with
the application, but are very fixed an not variable. If any of these value gets
touched, it is likely to break somewhere else. Using variables and calculation
only barely helps with this problem. As this is a very specialized custom
component, this inflexibility can be tolerated for now.
*/
$ballHeight: 1.75rem;
$ballWidth: 1.75rem;
$ballBorderWidth: 2px;
$liMarginY: 1.25rem;

li {
  margin-top: $liMarginY;
  margin-bottom: $liMarginY;
  @apply relative pl-10;
}

li::before {
  content: '';
  width: $ballWidth;
  height: $ballHeight;
  border: $ballBorderWidth solid;
  @apply absolute left-0 rounded-full text-center border-teal;
}

li.completed::before {
  @apply bg-green border-sea-green-35;
}

li.failed::before {
  @apply bg-red border-sea-green-35;
}

li:not(:last-of-type)::after {
  content: '';
  @apply absolute left-[0.75rem] border-teal border top-[1.7rem] h-[1.45rem];
}

li.hasError::after {
  height: calc(100% - $ballHeight + $liMarginY + $ballBorderWidth);
}

li > span.error-message {
  word-break: break-word;
}
</style>
