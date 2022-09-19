import type { JsonRpcSigner } from '@ethersproject/providers';
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import type { IEthereumProvider } from '@/services/web3-provider';
import { isAddressBlacklisted } from '@/utils/addressBlacklist';

export const useEthereumProvider = defineStore('ethereumProvider', {
  state: () => ({
    // We need a shallow reference here to prevent issues with ethers.js on
    // contract function calls.
    provider: shallowRef<IEthereumProvider | undefined>(undefined),
  }),
  getters: {
    signer: (state): JsonRpcSigner | undefined => state.provider?.signer.value,
    signerAddress: (state): string => state.provider?.signerAddress.value ?? '',
    chainId: (state): number => state.provider?.chainId.value ?? -1,
    isBlacklistedWallet(): boolean {
      if (!this.signerAddress) {
        return false;
      }

      return isAddressBlacklisted(this.signerAddress);
    },
  },
});
