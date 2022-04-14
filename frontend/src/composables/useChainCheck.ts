import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';

export default function useChainCheck() {
  const configuration = useConfiguration();
  const ethereumProvider = useEthereumProvider();

  const chainMatchesExpected = (expectedChainId: number) => {
    return ethereumProvider.chainId === expectedChainId;
  };

  const connectedChainSupported = () => {
    return String(ethereumProvider.chainId) in configuration.chains;
  };

  return { chainMatchesExpected, connectedChainSupported };
}
