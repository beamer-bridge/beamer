import { ShallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useChainCheck(ethereumProvider: ShallowRef<Readonly<EthereumProvider>>) {
  const chainMatchesExpected = async (expectedChainId: number) => {
    const chainId = await ethereumProvider.value.getChainId();
    return chainId === expectedChainId;
  };

  return { chainMatchesExpected };
}
