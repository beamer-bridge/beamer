import { JsonRpcSigner } from '@ethersproject/providers';
import type { Ref, ShallowRef } from 'vue';
import { ref, shallowRef } from 'vue';

import { EthereumProvider } from '@/services/web3-provider';

export class MockedEthereumProvider implements EthereumProvider {
  readonly signer: ShallowRef<JsonRpcSigner | undefined>;
  readonly signerAddress: ShallowRef<string | undefined>;
  readonly chainId: Ref<number>;

  constructor(options?: { chainId?: number; signer?: JsonRpcSigner; signerAddress?: string }) {
    this.signer = shallowRef(options?.signer);
    this.signerAddress = shallowRef(options?.signerAddress);
    this.chainId = ref(options?.chainId ?? 5);
  }

  init = jest.fn();
  requestSigner = jest.fn();
  getLatestBlock = jest.fn();
  connectContract = jest.fn();
  switchChain = jest.fn();
  addChain = jest.fn();
  getChainId = jest.fn(async () => this.chainId.value);
  addToken = jest.fn();
}
