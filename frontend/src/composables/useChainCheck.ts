import { ShallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';
import { useConfiguration } from '@/stores/configuration';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useChainCheck(ethereumProvider: ShallowRef<Readonly<EthereumProvider>>) {
  const configuration = useConfiguration();

  const chainMatchesExpected = async (expectedChainId: number) => {
    const chainId = await ethereumProvider.value.chainId.value;
    return chainId === expectedChainId;
  };

  const connectedChainSupported = async () => {
    const chainId = await ethereumProvider.value.chainId.value;
    return Object.prototype.hasOwnProperty.call(configuration.chains, String(chainId));
  };

  return { chainMatchesExpected, connectedChainSupported };
}
