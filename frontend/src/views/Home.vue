<template>
  <div class="home">
    <div v-if="criticalErrorMessage" class="home__error">{{ criticalErrorMessage }}</div>
    <RequestDialog v-else-if="ethereumProvider" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, provide, ref, shallowReadonly, ShallowRef, shallowRef } from 'vue';

import RequestDialog from '@/components/RequestDialog.vue';
import useChainCheck from '@/composables/useChainCheck';
import { createMetaMaskProvider, EthereumProvider } from '@/services/web3-provider';
import { EthereumProviderKey } from '@/symbols';

const criticalErrorMessage = ref('');
const ethereumProvider = shallowRef<EthereumProvider | undefined>(undefined);
const readonlyEthereumProvider = shallowReadonly(ethereumProvider);

provide(EthereumProviderKey, readonlyEthereumProvider);

onBeforeMount(async () => {
  ethereumProvider.value = await createMetaMaskProvider();

  if (ethereumProvider.value) {
    const { chainMatchesExpected } = useChainCheck(
      readonlyEthereumProvider as ShallowRef<Readonly<EthereumProvider>>,
    );
    const expectedChainId = Number(process.env.VUE_APP_CHAIN_ID);

    if (!(await chainMatchesExpected(expectedChainId))) {
      criticalErrorMessage.value = `Not connected to chain id ${expectedChainId}!`;
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
