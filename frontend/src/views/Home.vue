<template>
  <div class="home flex justify-center">
    <div class="max-w-2xl flex flex-col xl:justify-center xl:items-center">
      <div class="text-center text-orange-dark p-2 text-lg h-12">
        <div v-if="criticalErrorMessage">
          {{ criticalErrorMessage }}
        </div>
      </div>

      <div class="h-14">
        <div v-if="signer" class="flex flex-row gap-4 justify-center items-center">
          <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
          <span class="text-lg">You are currently connected via Metamask</span>
        </div>
      </div>

      <Card class="bg-teal mb-11">
        <RequestDialog
          v-if="ethereumProvider.provider"
          :key="requestDialogReloadKey"
          @reload="resetRequestDialog"
        />
      </Card>

      <div id="action-button-portal" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import { createMetaMaskProvider } from '@/services/web3-provider';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';

const criticalErrorMessage = ref('');
const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, chainId } = storeToRefs(ethereumProvider);
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
