<template>
  <div
    :class="classes"
    class="bg-transparent rounded-50 border-solid border-transparent border-t-solid border-t-sea-green animate-spin"
  />
</template>
<script lang="ts" setup>
interface Props {
  size?: string;
  border?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'full',
  border: '4',
});

const classes = `w-${props.size} h-${props.size} border-${props.border}`;
</script>
