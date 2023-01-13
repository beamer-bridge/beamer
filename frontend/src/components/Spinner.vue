<template>
  <div
    :class="classes"
    class="bg-transparent rounded-50 border-solid border-transparent border-t-solid border-t-sea-green animate-spin"
  />
</template>
<script lang="ts" setup>
interface Props {
  sizeClasses?: string;
  border?: string;
}

const props = withDefaults(defineProps<Props>(), {
  sizeClasses: 'w-full h-full',
  border: '4',
});

const classes = `${props.sizeClasses} border-${props.border}`;
</script>
