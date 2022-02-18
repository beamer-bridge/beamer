import { ref, ShallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';
import createAsyncProcess from '@/utils/create-async-process';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useRequestSigner(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
) {
  const requestSignerError = ref('');
  const requestSigner = async () => {
    requestSignerError.value = '';
    await ethereumProvider.value.requestSigner();
    if (!ethereumProvider.value.signer.value) {
      requestSignerError.value = 'Accessing Wallet failed!';
    }
  };
  const { active: requestSignerActive, run: runRequestSigner } = createAsyncProcess(requestSigner);
  return {
    requestSigner: runRequestSigner,
    requestSignerActive,
    requestSignerError,
  };
}
