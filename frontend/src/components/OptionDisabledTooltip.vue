<template>
  <Tooltip>
    <div class="flex h-full flex-col justify-center" data-test="tooltip-trigger">
      <img class="h-5 w-5 cursor-help" src="@/assets/images/help.svg" />
    </div>
    <template #hint>
      <div data-test="tooltip-text" class="overflow-visible">
        {{ text }}
      </div>
    </template>
  </Tooltip>
</template>

<script lang="ts" setup>
import Tooltip from '@/components/layout/Tooltip.vue';

interface Props {
  text: string;
}

defineProps<Props>();
</script>
