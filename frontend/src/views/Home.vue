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
import useChainCheck from '@/composables/useChainCheck';
import { createMetaMaskProvider } from '@/services/web3-provider';
import { useEthereumProvider } from '@/stores/ethereum-provider';

const criticalErrorMessage = ref('');
const ethereumProvider = useEthereumProvider();
const requestDialogReloadKey = ref(0);

const chainChangeHandler = () => {
  const { connectedChainSupported } = useChainCheck();
  criticalErrorMessage.value = connectedChainSupported() ? '' : 'Connected chain not supported!';
};

const resetRequestDialog = () => {
  requestDialogReloadKey.value += 1;
};

onMounted(async () => {
  ethereumProvider.provider = await createMetaMaskProvider();

  if (ethereumProvider.provider) {
    const { chainId } = storeToRefs(ethereumProvider);

    watch(chainId, chainChangeHandler);
    chainChangeHandler();
  } else {
    criticalErrorMessage.value = 'Could not detect MetaMask!';
  }
});
</script>
