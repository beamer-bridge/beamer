import type { JsonRpcSigner } from '@ethersproject/providers';
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';

export const useEthereumProvider = defineStore('ethereumProvider', {
  state: () => ({
    // We need a shallow reference here to prevent issues with ethers.js on
    // contract function calls.
    provider: shallowRef<EthereumProvider | undefined>(undefined),
  }),
  getters: {
    signer: (state): JsonRpcSigner | undefined => state.provider?.signer.value,
    signerAddress: (state): string => state.provider?.signerAddress.value ?? '',
    chainId: (state): number => state.provider?.chainId.value ?? -1,
  },
});
