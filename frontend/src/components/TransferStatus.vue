<template>
  <div v-if="label">
    Status:
    <span :class="statusClasses" data-test="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  completed?: boolean;
  failed?: boolean;
  active?: boolean;
}

const props = defineProps<Props>();

const label = computed(() =>
  props.completed
    ? 'Completed'
    : props.failed
    ? 'Failed'
    : props.active
    ? 'In Progress'
    : undefined,
);

const color = computed(() =>
  props.completed ? 'green' : props.failed ? 'red' : props.active ? 'green-lime' : 'black',
);

const statusClasses = computed(() => [`text-${color.value}`]);
</script>
