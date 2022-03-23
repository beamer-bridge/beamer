<template>
  <div class="home flex justify-center">
    <div class="max-w-2xl flex flex-col justify-center items-center">
      <Card v-if="criticalErrorMessage" class="text-center text-orange-dark p-2 text-lg">
        {{ criticalErrorMessage }}
      </Card>
      <RequestDialog
        v-if="ethereumProvider"
        :key="requestDialogReloadKey"
        @reload="resetRequestDialog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, shallowReadonly, ShallowRef, shallowRef, watch } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import useChainCheck from '@/composables/useChainCheck';
import { createMetaMaskProvider, EthereumProvider } from '@/services/web3-provider';
import { BeamerConfigKey, EthereumProviderKey } from '@/symbols';
import { injectStrict } from '@/utils/vue-utils';

const criticalErrorMessage = ref('');
const ethereumProvider = shallowRef<EthereumProvider | undefined>(undefined);
const readonlyEthereumProvider = shallowReadonly(ethereumProvider);
const requestDialogReloadKey = ref(0);

const beamerConfig = injectStrict(BeamerConfigKey);

const chainChangeHandler = async () => {
  const { connectedChainSupported } = useChainCheck(
    readonlyEthereumProvider as ShallowRef<Readonly<EthereumProvider>>,
  );
  const isSupportedChain = await connectedChainSupported(beamerConfig);
  if (!isSupportedChain) {
    criticalErrorMessage.value = `Connected chain not supported!`;
  } else {
    criticalErrorMessage.value = '';
  }
};

provide(EthereumProviderKey, readonlyEthereumProvider);

const resetRequestDialog = () => {
  requestDialogReloadKey.value += 1;
};

onMounted(async () => {
  ethereumProvider.value = await createMetaMaskProvider();
  if (ethereumProvider.value) {
    watch(ethereumProvider.value.chainId, () => {
      chainChangeHandler();
    });
    chainChangeHandler();
  } else {
    criticalErrorMessage.value = 'Could not detect MetaMask!';
  }
});
</script>
