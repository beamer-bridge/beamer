import { ref } from 'vue';

import type { MetaMaskProvider } from '@/services/web3-provider';
import createAsyncProcess from '@/utils/create-async-process';

export function useRequestSigner() {
  const error = ref<string | undefined>(undefined);

  const requestSigner = async (provider: MetaMaskProvider) => {
    error.value = undefined;

    provider.requestSigner && (await provider.requestSigner());

    if (!provider.signer.value) {
      error.value = 'Accessing Wallet failed!';
    }
  };

  const { active, run } = createAsyncProcess(requestSigner);
  return { run, active, error };
}
