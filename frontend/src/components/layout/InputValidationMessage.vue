<template>
  <div class="text-red-fire font-semibold tracking-wide pt-1 px-5">
    <slot>{{ message }}</slot>
  </div>
</template>
<script lang="ts" setup>
import type { Ref } from 'vue';

interface Props {
  message?: string | Ref<string>;
}
defineProps<Props>();
</script>
