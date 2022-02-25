<template>
  <li data-content="" class="step" :class="classObject">
    <slot></slot>
  </li>
</template>

<script setup lang="ts">
import { computed, defineProps, Ref, ref, toRef } from 'vue';

import { RequestState } from '@/types/data';

interface Props {
  readonly currentState: RequestState;
  readonly triggerState: RequestState;
  readonly warnState?: RequestState;
}
const props = defineProps<Props>();
/*const currentState = toRef(props, 'currentState')*/

const classObject = computed(() => {
  var showWarning = false;
  var showSuccess = false;

  const state = props.currentState;
  if (state) {
    if (props.warnState) {
      showWarning = state === props.warnState;
    }
    showSuccess = !showWarning && state >= props.triggerState;
  }

  const obj = {
    'step-warning': showWarning,
    'step-success': showSuccess,
  };
  return obj;
});
</script>
