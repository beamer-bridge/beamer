<template>
  <div ref="contentElement" class="cursor-help" @mouseover="showTooltip" @mouseout="hideTooltip">
    <slot />

    <div
      v-if="tooltipVisible"
      ref="tooltipElement"
      class="fixed text-sea-green text-xl bg-teal drop-shadow-xl rounded-md p-3 z-20"
      :style="tooltipStyle"
      data-test="tooltip"
    >
      <span class="arrow absolute bg-teal" :style="arrowStyles" data-test="arrow" />
      <span v-if="hint">{{ hint }}</span>
      <slot name="hint" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type Position = 'top' | 'left' | 'bottom' | 'right';

interface Props {
  hint?: string;
  position?: Position;
  showOutsideOfClosestReferenceElement?: boolean;
  referenceElementQuery?: string;
  maxTooltipWidth?: string;
  gap?: string;
  arrowSize?: number; // in pixels
}

const props = withDefaults(defineProps<Props>(), {
  hint: undefined,
  position: 'right',
  showOutsideOfClosestReferenceElement: false,
  referenceElementQuery: '.tooltip-reference-element',
  maxTooltipWidth: '40rem',
  gap: '2rem',
  arrowSize: 10,
});

const contentElement = ref<HTMLElement>();
const tooltipElement = ref<HTMLElement>();
const outsideOfElement = computed(() => {
  const closestReferenceElement = contentElement.value?.closest(props.referenceElementQuery);

  if (props.showOutsideOfClosestReferenceElement && closestReferenceElement) {
    return closestReferenceElement;
  } else {
    return contentElement.value;
  }
});

const tooltipLocation = computed(() => {
  const zeroBoundaries = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
  const {
    top: outsideTop,
    left: outsideLeft,
    bottom: outsideBottom,
    right: outsideRight,
  } = outsideOfElement.value?.getBoundingClientRect() ?? zeroBoundaries;

  const {
    top: contentTop,
    left: contentLeft,
    width: contentWidth,
    height: contentHeight,
  } = contentElement.value?.getBoundingClientRect() ?? zeroBoundaries;

  const { width: tooltipWidth, height: tooltipHeight } =
    tooltipElement.value?.getBoundingClientRect() ?? zeroBoundaries;

  const widthOffset = (tooltipWidth - contentWidth) / 2;
  const heightOffset = (tooltipHeight - contentHeight) / 2;

  switch (props.position) {
    case 'top':
      return { top: outsideTop - tooltipHeight, left: contentLeft - widthOffset };

    case 'left':
      return { top: contentTop - heightOffset, left: outsideLeft - tooltipWidth };

    case 'bottom':
      return { top: outsideBottom, left: contentLeft - widthOffset };

    case 'right':
      return { top: contentTop - heightOffset, left: outsideRight };

    default:
      return { top: 0, left: 0 };
  }
});

const tooltipStyle = computed(() => {
  const { position, gap } = props;
  const gapIsVertical = position == 'top' || position == 'bottom';
  const gapIsHorizontal = position == 'left' || position == 'right';

  return {
    top: `${tooltipLocation.value.top}px`,
    left: `${tooltipLocation.value.left}px`,
    maxWidth: props.maxTooltipWidth,
    margin: `${gapIsVertical ? gap : 0} ${gapIsHorizontal ? gap : 0}`,
  };
});

const arrowStyles = computed(() => {
  const { arrowSize: size } = props;
  const baseStyle = { width: `${size}px`, height: `${size}px` };
  const alignOffset = `calc(50% - ${size / 2}px)`;

  switch (props.position) {
    case 'top':
      return { ...baseStyle, bottom: `-${size / 2}px`, right: alignOffset };

    case 'left':
      return { ...baseStyle, top: alignOffset, right: `-${size}px` };

    case 'bottom':
      return { ...baseStyle, top: `-${size / 2}px`, right: alignOffset };

    case 'right':
      return { ...baseStyle, top: alignOffset, left: 0 };

    default:
      return baseStyle;
  }
});

const tooltipVisible = ref(false);

function showTooltip() {
  tooltipVisible.value = true;
}

function hideTooltip() {
  tooltipVisible.value = false;
}
</script>

<style>
/* Exception because this is hard to express with Tailwind classes. */
.arrow {
  transform: translate(-50%, 0) rotate(45deg);
}
</style>
