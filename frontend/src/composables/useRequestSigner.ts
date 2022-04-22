import { ref } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';
import createAsyncProcess from '@/utils/create-async-process';

export function useRequestSigner() {
  const error = ref<string | undefined>(undefined);

  const requestSigner = async (provider: EthereumProvider) => {
    error.value = undefined;

    await provider.requestSigner();

    if (!provider.signer.value) {
      error.value = 'Accessing Wallet failed!';
    }
  };

  const { active, run } = createAsyncProcess(requestSigner);
  return { run, active, error };
}
