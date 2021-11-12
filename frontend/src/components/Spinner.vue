<template>
  <div class="spinner" />
</template>

<script lang="ts">
import { Vue } from 'vue-property-decorator';

export default class Spinner extends Vue {}
</script>

<style scoped lang="scss">
@import '@/scss/colors';
@import '@/scss/animations';

.spinner {
  border: solid transparent;
  border-top: solid $text-color;
  border-width: 4px;
  border-radius: 50%;
  width: 100%;
  height: 100%;
  animation: $spinning-animation;
  background-color: transparent;
}

.delay-enter-active {
  opacity: 0;
  transition-delay: 1.5s;
}
</style>
