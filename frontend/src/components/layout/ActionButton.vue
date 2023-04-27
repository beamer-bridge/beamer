<template>
  <button
    class="flex h-12 min-w-[17rem] items-center justify-center rounded-full bg-green px-8 text-xl text-teal shadow hover:opacity-90 disabled:opacity-60"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  disabled?: boolean;
}

defineProps<Props>();
</script>
