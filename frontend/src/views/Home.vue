<template>
  <div class="home flex justify-center">
    <div class="w-[40rem] flex flex-col xl:justify-center xl:items-center">
      <div class="text-center text-orange-dark p-2 text-lg h-12">
        <div v-if="errorMessage">
          {{ errorMessage }}
        </div>
      </div>

      <div class="h-14">
        <div v-if="signer" class="flex flex-row gap-4 justify-center items-center">
          <div class="h-7 w-7 rounded-50 border-4 border-solid border-teal-light bg-green"></div>
          <span class="text-lg">You are currently connected via Metamask</span>
        </div>
      </div>

      <Card class="bg-teal mb-11 w-full min-h-[50rem]">
        <Tabs :tabs="tabs" />
      </Card>

      <div id="action-button-portal" class="flex justify-center">
        <FormKit
          v-if="!signer"
          input-class="w-112 bg-orange flex flex-row justify-center"
          type="button"
          @click="runRequestSigner"
        >
          <div v-if="requestSignerActive" class="h-8 w-8">
            <Spinner />
          </div>
          <template v-else>Connect MetaMask Wallet</template>
        </FormKit>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import Tabs from '@/components/layout/Tabs.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import Spinner from '@/components/Spinner.vue';
import { useRequestSigner } from '@/composables/useRequestSigner';
import { createMetaMaskProvider } from '@/services/web3-provider';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';

const criticalErrorMessage = ref('');
const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const {
  run: requestSigner,
  active: requestSignerActive,
  error: requestSignerError,
} = useRequestSigner();

const tabs = [
  {
    label: 'Transfer',
    content: RequestDialog,
  },
  {
    label: 'Activity',
    content: null,
  },
];

const runRequestSigner = () => {
  // TOOD: In future we will not separate getting provider and signer which
  // resolve the undefined provider case.
  if (provider.value) {
    requestSigner(provider.value);
  }
};

const chainChangeHandler = () => {
  const isSupported = ethereumProvider.chainId in configuration.chains;
  criticalErrorMessage.value = isSupported ? '' : 'Connected chain not supported!';
};

const errorMessage = computed(() => {
  return criticalErrorMessage.value || requestSignerError.value;
});

watch(chainId, chainChangeHandler);

onMounted(async () => {
  provider.value = await createMetaMaskProvider();

  if (!provider.value) {
    criticalErrorMessage.value = 'Could not detect MetaMask!';
  }
});
</script>
