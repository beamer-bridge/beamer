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
  expired?: boolean;
  active?: boolean;
}

const props = defineProps<Props>();

const label = computed(() =>
  props.completed
    ? 'Completed'
    : props.expired
    ? 'Expired'
    : props.failed
    ? 'Failed'
    : props.active
    ? 'In Progress'
    : undefined,
);

const color = computed(() =>
  props.completed || props.active ? 'green' : props.failed ? 'red' : 'black',
);

const statusClasses = computed(() => [`text-${color.value}`]);
</script>
