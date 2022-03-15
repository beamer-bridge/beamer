import { Ref, ShallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';
import { BeamerConfig } from '@/types/config';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useChainCheck(ethereumProvider: ShallowRef<Readonly<EthereumProvider>>) {
  const chainMatchesExpected = async (expectedChainId: number) => {
    const chainId = await ethereumProvider.value.chainId.value;
    return chainId === expectedChainId;
  };

  const connectedChainSupported = async (beamerConfig: Ref<Readonly<BeamerConfig>>) => {
    const chainId = await ethereumProvider.value.chainId.value;
    return Object.prototype.hasOwnProperty.call(beamerConfig.value.chains, String(chainId));
  };

  return { chainMatchesExpected, connectedChainSupported };
}
