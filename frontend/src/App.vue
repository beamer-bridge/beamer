<template>
  <div class="view">
    <router-view v-if="config" class="view__route" />
    <div v-else class="view__spinner-container">
      <spinner></spinner>
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide } from 'vue';

import Spinner from '@/components/Spinner.vue';
import useRaisyncConfig from '@/composables/useRaisyncConfig';
import { RaisyncConfigKey } from '@/symbols';

const { config } = useRaisyncConfig();

provide(RaisyncConfigKey, config);
</script>

<style lang="scss">
@import '@/scss/colors';

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: $text-color;
  background: linear-gradient(90deg, $primary, $background-color-dark);
  width: 100%;
  min-height: 100vh;
  display: flex;
}

.view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;

  &__route {
    background-color: $background-color;
    border-radius: 10px;
    font-size: 18px;
    line-height: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 32px 24px 32px;
    max-width: 554px;
  }

  &__spinner-container {
    width: 200px;
    height: 200px;
  }
}
</style>
