import { ref } from 'vue';

import { useEthereumProvider } from '@/stores/ethereum-provider';
import createAsyncProcess from '@/utils/create-async-process';

export default function useRequestSigner() {
  const requestSignerError = ref('');
  const ethereumProvider = useEthereumProvider();
  const requestSigner = async () => {
    requestSignerError.value = '';
    await ethereumProvider.provider?.requestSigner();
    if (!ethereumProvider.signer) {
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
