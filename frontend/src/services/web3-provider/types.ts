import { JsonRpcSigner } from '@ethersproject/providers';
import { Ref, ShallowRef } from 'vue';

export interface EthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  requestSigner(): Promise<void>;
  switchChain?(newChainId: number, rpcUrl?: string): Promise<void>;
}
