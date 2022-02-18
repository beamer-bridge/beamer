<template>
  <div class="home flex justify-center pt-56">
    <div class="max-w-2xl flex-auto">
      <Card v-if="criticalErrorMessage" class="text-center text-orange-dark">
        {{ criticalErrorMessage }}
      </Card>
      <RequestDialog v-else-if="ethereumProvider" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, shallowReadonly, ShallowRef, shallowRef } from 'vue';

import Card from '@/components/layout/Card.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import useChainCheck from '@/composables/useChainCheck';
import { createMetaMaskProvider, EthereumProvider } from '@/services/web3-provider';
import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import { injectStrict } from '@/utils/vue-utils';

const criticalErrorMessage = ref('');
const ethereumProvider = shallowRef<EthereumProvider | undefined>(undefined);
const readonlyEthereumProvider = shallowReadonly(ethereumProvider);

const raisyncConfig = injectStrict(RaisyncConfigKey);

provide(EthereumProviderKey, readonlyEthereumProvider);

onMounted(async () => {
  ethereumProvider.value = await createMetaMaskProvider();

  if (ethereumProvider.value) {
    const { connectedChainSupported } = useChainCheck(
      readonlyEthereumProvider as ShallowRef<Readonly<EthereumProvider>>,
    );

    if (!(await connectedChainSupported(raisyncConfig.value))) {
      criticalErrorMessage.value = `Connected chain not supported!`;
    }
  } else {
    criticalErrorMessage.value = 'Could not detect MetaMask!';
  }
});
</script>
