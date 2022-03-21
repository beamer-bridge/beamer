<template>
  <img
    class="absolute top-[112px] left-[112px] w-[458px]"
    src="@/assets/images/logo.svg"
    alt="logo"
  />
  <router-view v-if="config" class="flex-auto m-3.5 z-10" />
  <div v-else class="flex-auto flex flex-col items-center justify-center">
    <div class="w-48 h-48">
      <spinner></spinner>
    </div>
  </div>
  <feedback></feedback>
  <footer class="my-8 text-2xl text-center text-teal-light">Powered by Beamer</footer>
</template>

<script setup lang="ts">
import { provide } from 'vue';

import Feedback from '@/components/Feedback.vue';
import Spinner from '@/components/Spinner.vue';
import useBeamerConfig from '@/composables/useBeamerConfig';
import { BeamerConfigKey } from '@/symbols';

const { config } = useBeamerConfig();

provide(BeamerConfigKey, config);
</script>

<style lang="css">
#app {
  font-family: 'Sora', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: theme('colors.light');
  background: linear-gradient(180deg, theme('colors.teal-dark') 0%, theme('colors.teal') 100%);
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
