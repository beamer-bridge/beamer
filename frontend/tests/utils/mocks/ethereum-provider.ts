import type { JsonRpcSigner } from '@ethersproject/providers';
import type { Ref, ShallowRef } from 'vue';
import { ref, shallowRef } from 'vue';

import type { EventEmitter, IEthereumProvider, ISigner } from '@/services/web3-provider';

export class MockedEthereumProvider implements IEthereumProvider, EventEmitter {
  readonly signer: ShallowRef<JsonRpcSigner | undefined>;
  readonly signerAddress: ShallowRef<string | undefined>;
  readonly chainId: Ref<number>;

  constructor(options?: { chainId?: number; signer?: JsonRpcSigner; signerAddress?: string }) {
    this.signer = shallowRef(options?.signer);
    this.signerAddress = shallowRef(options?.signerAddress);
    this.chainId = ref(options?.chainId ?? 5);
  }

  init = vi.fn();
  getLatestBlock = vi.fn();
  connectContract = vi.fn();
  switchChainSafely = vi.fn();
  switchChain = vi.fn();
  addChain = vi.fn();
  getChainId = vi.fn(async () => this.chainId.value);
  addToken = vi.fn();
  on = vi.fn();
  emit = vi.fn();
}

export class MockedMetaMaskProvider extends MockedEthereumProvider implements ISigner {
  constructor(options?: { chainId?: number; signer?: JsonRpcSigner; signerAddress?: string }) {
    super(options);
  }

  requestSigner = vi.fn();
}

export class MockedWalletConnectProvider extends MockedEthereumProvider {
  constructor(options?: { chainId?: number; signer?: JsonRpcSigner; signerAddress?: string }) {
    super(options);
  }
}
