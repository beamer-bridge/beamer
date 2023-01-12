<template>
  <button
    class="min-w-[17rem] h-12 px-8 flex justify-center items-center rounded-full bg-green text-teal text-xl shadow hover:opacity-90 disabled:opacity-60"
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
