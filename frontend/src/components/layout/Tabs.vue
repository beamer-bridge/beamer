<template>
  <div class="w-full h-full flex flex-col">
    <div class="w-full h-[6rem] flex items-stretch">
      <div
        class="tab-header"
        :class="leftTabHeaderClasses"
        data-test="left-tab-header"
        @click="switchToLeftTab"
      >
        {{ leftLabel }}
      </div>

      <div
        class="tab-header"
        :class="rightTabHeaderClasses"
        data-test="right-tab-header"
        @click="switchToRightTab"
      >
        {{ rightLabel }}
      </div>
    </div>

    <div class="w-full h-full p-16" data-test="tab-content">
      <KeepAlive>
        <component :is="activeTabContentComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';

interface Props {
  leftLabel: string;
  rightLabel: string;
  leftContentComponent: Component;
  rightContentComponent: Component;
}

const props = defineProps<Props>();

enum TabEntry {
  LEFT = 'left',
  RIGHT = 'right',
}

const activeTab = ref<TabEntry>(TabEntry.LEFT);
const activeTabContentComponent = shallowRef<Component | null>(null);

const leftTabIsActive = computed(() => activeTab.value === TabEntry.LEFT);
const rightTabIsActive = computed(() => activeTab.value === TabEntry.RIGHT);

const switchToLeftTab = () => (activeTab.value = TabEntry.LEFT);
const switchToRightTab = () => (activeTab.value = TabEntry.RIGHT);

const leftTabHeaderClasses = computed(() => getTabHeaderClasses(leftTabIsActive.value));
const rightTabHeaderClasses = computed(() => getTabHeaderClasses(rightTabIsActive.value));

function getTabHeaderClasses(active: boolean): Record<string, boolean> {
  return {
    'cursor-pointer': !active,
    'bg-teal-dark/40': !active,
    'text-teal-light': active,
    'text-teal-light/40': !active,
  };
}

/*
 * The much more straight forward solution would be to use a computed value to
 * define the active content component. But in the context of a `<component>`
 * usage, this doesn't work in practice. There the watcher is used to always set
 * the component when the tab changes. And again, unfortunately it doesn't work
 * to simply use an `immediate` watcher. Instead an `onMounted` hook must be
 * defined too.
 */
onMounted(() => {
  activeTabContentComponent.value = props.leftContentComponent;
});

watch(activeTab, () => {
  let contentComponent = null;

  switch (activeTab.value) {
    case TabEntry.LEFT:
      contentComponent = props.leftContentComponent;
      break;

    case TabEntry.RIGHT:
      contentComponent = props.rightContentComponent;
      break;
  }

  activeTabContentComponent.value = contentComponent;
});
</script>

<style>
.tab-header {
  @apply flex grow justify-center items-center text-3xl;
}
</style>
