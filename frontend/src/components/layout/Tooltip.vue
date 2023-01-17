<template>
  <Popper v-bind="$attrs" hover open-delay="50" close-delay="100" arrow :class="theme">
    <div data-test="tooltip-trigger"><slot /></div>
    <template #content="props">
      <div data-test="tooltip-content">
        <slot name="hint" v-bind="props" data-test="tooltip" />
      </div>
    </template>
  </Popper>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Popper from 'vue3-popper';

const theme = ref('tooltip-beamer');
</script>

<style>
.tooltip-beamer {
  --popper-theme-background-color: theme('colors.teal');
  --popper-theme-background-color-hover: theme('colors.black');
  --popper-theme-text-color: theme('colors.sea-green.DEFAULT');
  --popper-theme-border-width: 1px;
  --popper-theme-border-style: solid;
  --popper-theme-border-color: theme('colors.teal-dark');
  --popper-theme-border-radius: 6px;
  --popper-theme-padding: 1rem;
  --popper-theme-box-shadow: 0 6px 30px -6px rgba(0, 0, 0, 0.25);
}
</style>
