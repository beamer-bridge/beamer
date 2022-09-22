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
      <span
        class="-translate-x-1/2 rotate-45 absolute bg-teal"
        :style="arrowStyles"
        data-test="arrow"
      />
      <span v-if="hint">{{ hint }}</span>
      <slot name="hint" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { computed, ref } from 'vue';

type Position = 'bottom' | 'right';

interface Props {
  hint?: string;
  showOutsideOfClosestReferenceElement?: boolean;
  referenceElementQuery?: string;
  tooltipWidth?: string;
  gap?: string;
  arrowSize?: number; // in pixels
}

const props = withDefaults(defineProps<Props>(), {
  hint: undefined,
  showOutsideOfClosestReferenceElement: false,
  referenceElementQuery: '.tooltip-reference-element',
  tooltipWidth: '40rem',
  gap: '2rem',
  arrowSize: 10,
});

const ZERO_BOUNDARIES = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };

const contentElement = ref<HTMLElement>();
const tooltipElement = ref<HTMLElement>();

const tooltipClientRect = computed(
  () => tooltipElement.value?.getBoundingClientRect() ?? ZERO_BOUNDARIES,
);

const fitsInViewport = computed(() => {
  const { right: tooltipRight } = tooltipClientRect.value;
  return tooltipRight <= window.innerWidth;
});

const position: ComputedRef<Position> = computed(() => {
  return fitsInViewport.value ? 'right' : 'bottom';
});

const outsideOfElement = computed(() => {
  const closestReferenceElement = contentElement.value?.closest(props.referenceElementQuery);

  if (
    props.showOutsideOfClosestReferenceElement &&
    closestReferenceElement &&
    fitsInViewport.value
  ) {
    return closestReferenceElement;
  } else {
    return contentElement.value;
  }
});

const tooltipLocation = computed(() => {
  const { bottom: outsideBottom, right: outsideRight } =
    outsideOfElement.value?.getBoundingClientRect() ?? ZERO_BOUNDARIES;

  const {
    top: contentTop,
    left: contentLeft,
    width: contentWidth,
    height: contentHeight,
  } = contentElement.value?.getBoundingClientRect() ?? ZERO_BOUNDARIES;

  const { width: tooltipWidth, height: tooltipHeight } = tooltipClientRect.value;

  const widthOffset = (tooltipWidth - contentWidth) / 2;
  const heightOffset = (tooltipHeight - contentHeight) / 2;

  switch (position.value) {
    case 'bottom':
      return { top: outsideBottom, left: Math.max(contentLeft - widthOffset, 0) };

    case 'right':
      return { top: contentTop - heightOffset, left: outsideRight };

    default:
      return { top: 0, left: 0 };
  }
});

const tooltipStyle = computed(() => {
  const gapIsVertical = position.value == 'bottom';
  const gapIsHorizontal = position.value == 'right';

  return {
    top: `${tooltipLocation.value.top}px`,
    left: `${tooltipLocation.value.left}px`,
    margin: `${gapIsVertical ? props.gap : 0} ${gapIsHorizontal ? props.gap : 0}`,
    [fitsInViewport.value ? 'width' : 'maxWidth']: props.tooltipWidth,
  };
});

const arrowStyles = computed(() => {
  const { arrowSize: size } = props;
  const baseStyle = { width: `${size}px`, height: `${size}px` };
  const alignOffset = `calc(50% - ${size / 2}px)`;

  switch (position.value) {
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
