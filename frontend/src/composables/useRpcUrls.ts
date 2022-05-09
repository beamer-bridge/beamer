import { ChainConfigMapping } from '@/types/config';

export function useRpcUrls(chains: ChainConfigMapping) {
  const rpcUrlsList = Object.keys(chains).reduce((prev, curr) => {
    return { ...prev, [curr]: chains[curr].rpcUrl };
  }, {});
  return rpcUrlsList;
}
