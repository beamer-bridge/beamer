<template>
  <div class="flex justify-center items-center pt-12 pb-12">
    <img class="w-[30rem]" src="@/assets/images/logo.svg" alt="logo" />
  </div>
  <router-view v-if="configurationLoaded" class="flex-auto z-10" />
  <div v-else class="flex-auto flex flex-col items-center justify-center">
    <div class="w-48 h-48">
      <spinner></spinner>
    </div>
  </div>
  <feedback v-if="enableFeedback"></feedback>
  <imprint-modal></imprint-modal>
  <footer class="my-8 text-lg text-center text-teal-light">
    Powered by Beamer &bull;
    <label for="imprint-modal" class="btn-link modal-button">Imprint</label>
  </footer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import Feedback from '@/components/Feedback.vue';
import Spinner from '@/components/Spinner.vue';
import { useConfiguration } from '@/stores/configuration';
import type { BeamerConfig } from '@/types/config';

import ImprintModal from './components/ImprintModal.vue';

const enableFeedback = false;
const configuration = useConfiguration();
const configurationLoaded = ref(false);

const fetchConfigurationFile = async (): Promise<BeamerConfig> => {
  try {
    const response = await fetch(import.meta.env.VITE_CONFIG_URL);
    return response.json();
  } catch (error) {
    console.error(error);
    return { chains: {} };
  }
};

onMounted(async () => {
  const configurationFile = await fetchConfigurationFile();

  for (const [chainId, chainConfiguration] of Object.entries(configurationFile.chains)) {
    configuration.setChainConfiguration(chainId, chainConfiguration);
  }

  configurationLoaded.value = true;
});
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
