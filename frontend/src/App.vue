<template>
  <div class="logo"></div>
  <div class="view">
    <router-view v-if="config" class="view__route" />
    <div v-else class="view__spinner-container">
      <spinner></spinner>
    </div>
  </div>
  <div class="footer">
    <div class="footer__content">
      <div>Powered by Raisync</div>
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
  background: linear-gradient(180deg, $background-color-dark 0%, $background-color 100%);
  width: 100%;
  min-height: 100vh;
  display: flex;
}

.logo {
  position: absolute;
  top: 50px;
  left: 50px;
  width: 200px;
  height: 100px;
  background-image: url('./assets/images/logo.svg');
  background-size: contain;
}

.footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding-bottom: 10px;

  &__content {
    align-items: center;
  }
}

.view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;

  &__route {
    background-color: $background-color;
    border-radius: 45px;
    box-shadow: 0px 4px 26px rgba(0, 0, 0, 0.25);
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
