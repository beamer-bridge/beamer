import { Ref, ShallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';
import { RaisyncConfig } from '@/types/config';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useChainCheck(ethereumProvider: ShallowRef<Readonly<EthereumProvider>>) {
  const chainMatchesExpected = async (expectedChainId: number) => {
    const chainId = await ethereumProvider.value.getChainId();
    return chainId === expectedChainId;
  };

  const connectedChainSupported = async (raisyncConfig: Ref<Readonly<RaisyncConfig>>) => {
    const chainId = await ethereumProvider.value.getChainId();
    return Object.prototype.hasOwnProperty.call(raisyncConfig.value.chains, String(chainId));
  };

  return { chainMatchesExpected, connectedChainSupported };
}
