import { Block, JsonRpcSigner } from '@ethersproject/providers';
import { Contract } from 'ethers';
import { Ref, ShallowRef } from 'vue';

import { ChainData } from '@/types/config';

export interface EthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  requestSigner(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  connectContract(contract: Contract): Contract;
  switchChain(newChainId: number): Promise<boolean | null>;
  addChain(chainData: ChainData): Promise<boolean>;
  getChainId(): Promise<number>;
}
