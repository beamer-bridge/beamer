<template>
  <div class="w-full h-full flex flex-col overflow-hidden rounded-lg">
    <div class="tab-header w-full flex bg-teal">
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

    <div class="tab-content w-full" data-test="tab-content">
      <!-- classes are applied here to provide a uniform styling to all components that are rendered inside the tabs -->
      <KeepAlive>
        <component
          :is="activeTab.content"
          v-if="activeTab"
          :key="activeTab.label"
          class="bg-teal p-16 h-full"
        />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { computed, shallowRef, watch } from 'vue';

interface Props {
  tabs: Array<{
    label: string;
    content: Component;
  }>;
  activeTabLabel?: string;
}

interface Emits {
  (e: 'tabChanged', value: string): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();
const activeTab = shallowRef(props.tabs[0]);
const headers = computed(() =>
  props.tabs.map((tab) => ({
    label: tab.label,
    click: () => (activeTab.value = tab),
    classes: {
      'cursor-pointer': tab.label != activeTab.value.label,
      'bg-teal-dark/40': tab.label != activeTab.value.label,
      'text-teal-light': tab.label == activeTab.value.label,
      'text-teal-light/40': tab.label != activeTab.value.label,
    },
  })),
);

watch(
  () => props.activeTabLabel,
  () => {
    const targetTab = props.tabs.find((tab) => tab.label === props.activeTabLabel);
    activeTab.value = targetTab ?? activeTab.value;
  },
  { immediate: true },
);

watch(activeTab, () => emits('tabChanged', activeTab.value.label));
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
