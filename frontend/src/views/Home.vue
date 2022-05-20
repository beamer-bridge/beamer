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
          <span class="text-lg">You are currently connected</span>
        </div>
      </div>

      <Card class="bg-teal mb-11 w-full min-h-[50rem]">
        <Tabs :tabs="tabs" />
      </Card>

      <div id="action-button-portal" class="flex justify-center">
        <div v-if="!signer" class="flex w-full gap-2">
          <div class="flex-1 w-full">
            <FormKit
              class="w-full"
              input-class="w-full bg-orange flex flex-row justify-center"
              type="button"
              @click="connectMetaMask"
            >
              <div v-if="requestSignerActive" class="h-8 w-8">
                <spinner></spinner>
              </div>
              <template v-else>MetaMask</template>
            </FormKit>
          </div>
          <div class="flex-1 w-full">
            <FormKit
              input-class="w-full bg-orange flex flex-row justify-center"
              type="button"
              @click="connectWalletConnect"
            >
              WalletConnect
            </FormKit>
          </div>
        </div>
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
import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';

const ethereumProvider = useEthereumProvider();
const configuration = useConfiguration();
const settings = useSettings();
const { connectedWallet } = storeToRefs(settings);

const criticalErrorMessage = ref('');
const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const {
  run: requestSigner,
  active: requestSignerActive,
  error: requestSignerError,
} = useRequestSigner();

const { connectMetaMask, connectWalletConnect, getConnectedWalletProvider } = useWallet(
  provider,
  connectedWallet,
  configuration.rpcUrls,
  requestSigner,
);

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

const isSupportedChain = computed(() => configuration.isSupportedChain(ethereumProvider.chainId));

const chainChangeHandler = () => {
  criticalErrorMessage.value = isSupportedChain.value ? '' : 'Connected chain is not supported!';
};

const errorMessage = computed(() => {
  return criticalErrorMessage.value || requestSignerError.value;
});

watch(chainId, chainChangeHandler);

onMounted(async () => {
  provider.value = await getConnectedWalletProvider();
});
</script>
