<template>
  <div class="home">
    <div v-if="criticalErrorMessage" class="home__error">{{ criticalErrorMessage }}</div>
    <RequestDialog v-else-if="ethereumProvider" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, shallowReadonly, ShallowRef, shallowRef } from 'vue';

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

<style lang="scss" scoped>
.home {
  width: 600px;
}
</style>
