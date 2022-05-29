<template>
  <button
    class="min-w-[17rem] h-20 px-8 flex justify-center items-center rounded-full bg-green text-teal text-2xl shadow hover:opacity-90 disabled:opacity-60"
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
