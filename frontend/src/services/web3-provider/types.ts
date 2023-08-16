import type { Block, JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import type { Ref, ShallowRef } from 'vue';

import type { Chain, Token, TransactionHash } from '@/types/data';

export interface IEthereumProvider {
  chainId: Ref<number>;

  init(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  getProvider(): JsonRpcProvider;
  getChainId(): Promise<number>;
  waitForTransaction(
    transactionHash: TransactionHash,
    confirmations?: number,
    timeout?: number,
  ): Promise<TransactionHash>;
}

export interface IEthereumWallet extends IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  disconnectable: boolean;
  isContractWallet: boolean;
  disconnect(): void;
  switchChainSafely?(newChain: Chain): Promise<boolean>;
  addToken?(token: Token): Promise<boolean>;
  getActualTransactionHash?(internalTransactionHash: string): Promise<string>;
  closeExternalConnection?(): Promise<void>;
}

export interface EventEmitter {
  on(eventName: string, listener: (...args: unknown[]) => void): void;
  emit(eventName: string): void;
}

interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

export interface DisconnectableProvider {
  disconnect(): Promise<void>;
}

export type ExternalProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  sendAsync?: (
    request: RequestArguments,
    callback: (error: unknown, response: unknown) => void,
  ) => void;
  send?: (
    request: RequestArguments,
    callback: (error: unknown, response: unknown) => void,
  ) => void;
  request?: (request: RequestArguments) => Promise<unknown>;
};

export type Eip1193Provider = {
  request(args: RequestArguments): Promise<unknown>;
  on(eventName: string, listener: (...args: unknown[]) => void): void;
};

export type DetectedEthereumProvider =
  | ExternalProvider & {
      providers?: Array<ExternalProvider>;
    };
