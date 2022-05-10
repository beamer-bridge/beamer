<template>
  <ul class="steps steps-vertical">
    <ProgressStep
      v-for="(step, index) in steps"
      :key="index"
      :label="step.label"
      :completed="step.completed"
      :failed="step.failed"
    />
  </ul>
</template>

<script setup lang="ts">
import ProgressStep from '@/components/layout/ProgressStep.vue';

interface Props {
  readonly steps: Array<{
    label: string;
    completed?: boolean;
    failed?: boolean;
  }>;
}

defineProps<Props>();
</script>
