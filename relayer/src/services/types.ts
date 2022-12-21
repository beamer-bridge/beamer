import type { Provider } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";

export type TransactionHash = string;

export type BaseRelayerServiceConstructor = new (params: {
  l1RpcURL: string;
  l2RpcURL: string;
  privateKey: string;
}) => BaseRelayerService;

export abstract class BaseRelayerService {
  readonly l1Wallet: Wallet;
  readonly l2Wallet: Wallet;

  constructor(params: { l1RpcURL: string; l2RpcURL: string; privateKey: string }) {
    this.l1Wallet = new Wallet(params.privateKey, new JsonRpcProvider(params.l1RpcURL));
    this.l2Wallet = new Wallet(params.privateKey, new JsonRpcProvider(params.l2RpcURL));
  }

  get l2RpcProvider(): Provider {
    return this.l2Wallet.provider;
  }

  get l1RpcProvider(): Provider {
    return this.l1Wallet.provider;
  }

  async getL1ChainId() {
    return (await this.l1RpcProvider.getNetwork()).chainId;
  }

  async getL2ChainId() {
    return (await this.l2RpcProvider.getNetwork()).chainId;
  }

  abstract prepare(): Promise<boolean>;
  abstract relayTxToL1(l2TransactionHash: TransactionHash): Promise<TransactionHash>;
  abstract finalize(l1TransactionHash: TransactionHash): Promise<void>;
}
