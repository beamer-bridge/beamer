<template>
  <div class="home flex justify-center">
    <div class="max-w-2xl flex flex-col xl:justify-center xl:items-center">
      <div class="text-center text-orange-dark p-2 text-lg h-12">
        <div v-if="criticalErrorMessage">
          {{ criticalErrorMessage }}
        </div>
      </div>
      <RequestDialog
        v-if="ethereumProvider.provider"
        :key="requestDialogReloadKey"
        @reload="resetRequestDialog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue';

import RequestDialog from '@/components/RequestDialog.vue';
import { createMetaMaskProvider } from '@/services/web3-provider';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';

const criticalErrorMessage = ref('');
const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, chainId } = storeToRefs(ethereumProvider);
const requestDialogReloadKey = ref(0);

const chainChangeHandler = () => {
  const isSupported = ethereumProvider.chainId in configuration.chains;
  criticalErrorMessage.value = isSupported ? '' : 'Connected chain not supported!';
};

const resetRequestDialog = () => {
  requestDialogReloadKey.value += 1;
};

watch(chainId, chainChangeHandler);

onMounted(async () => {
  provider.value = await createMetaMaskProvider();

  if (!provider.value) {
    criticalErrorMessage.value = 'Could not detect MetaMask!';
  }
});
</script>
