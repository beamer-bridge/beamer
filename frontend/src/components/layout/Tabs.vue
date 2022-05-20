<template>
  <div class="w-full h-full flex flex-col overflow-hidden">
    <div class="tab-header w-full flex">
      <div
        v-for="header of headers"
        :key="header.label"
        class="flex grow items-center justify-center text-3xl"
        :class="header.classes"
        data-test="tab-header"
        @click="header.click"
      >
        {{ header.label }}
      </div>
    </div>

    <div class="tab-content w-full p-16" data-test="tab-content">
      <KeepAlive>
        <component :is="activeTab.content" v-if="activeTab" :key="activeTab.label" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { computed, shallowRef } from 'vue';

interface Props {
  tabs: Array<{
    label: string;
    content: Component;
  }>;
}

const props = defineProps<Props>();

const activeTab = shallowRef(props.tabs[0]);

const headers = computed(() =>
  props.tabs.map((tab) => ({
    label: tab.label,
    click: () => (activeTab.value = tab),
    classes: {
      'cursor-pointer': tab != activeTab.value,
      'bg-teal-dark/40': tab != activeTab.value,
      'text-teal-light': tab == activeTab.value,
      'text-teal-light/40': tab != activeTab.value,
    },
  })),
);
</script>

<style lang="scss">
$header-height: 6rem;

.tab-header {
  min-height: $header-height;
}

.tab-content {
  height: calc(100% - #{$header-height});
}
</style>
