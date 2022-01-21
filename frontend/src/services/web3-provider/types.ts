import { JsonRpcSigner } from '@ethersproject/providers';

export interface EthereumProvider {
  signer: JsonRpcSigner | undefined;
  init(): Promise<void>;
  getChainId(): Promise<number>;
  requestSigner(): Promise<void>;
  switchChain?(newChainId: number, rpcUrl?: string): Promise<void>;
}
