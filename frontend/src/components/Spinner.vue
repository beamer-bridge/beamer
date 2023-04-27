<template>
  <div
    :class="classes"
    class="border-t-solid animate-spin rounded-50 border-solid border-transparent border-t-sea-green bg-transparent"
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
