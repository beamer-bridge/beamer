<template>
  <ul class="steps steps-vertical text-left w-full px-5">
    <ProgressStep v-for="(step, index) in steps" :key="index" v-bind="step" />
  </ul>
</template>

<script setup lang="ts">
import ProgressStep from '@/components/layout/ProgressStep.vue';

interface Props {
  readonly steps: Array<{
    label: string;
    completed?: boolean;
    failed?: boolean;
    errorMessage?: string;
  }>;
}

defineProps<Props>();
</script>
