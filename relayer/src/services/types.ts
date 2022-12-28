import type { Provider } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";

import type { ArbitrumRelayerService } from "./arbitrum";
import type { BobaRelayerService } from "./boba";
import type { OptimismRelayerService } from "./optimism";

export type TransactionHash = string;

export type ExtendedRelayerService =
  | typeof ArbitrumRelayerService
  | typeof BobaRelayerService
  | typeof OptimismRelayerService;

export abstract class BaseRelayerService {
  readonly l1Wallet: Wallet;
  readonly l2Wallet: Wallet;

  constructor(l1RpcURL: string, l2RpcURL: string, privateKey: string) {
    this.l1Wallet = new Wallet(privateKey, new JsonRpcProvider(l1RpcURL));
    this.l2Wallet = new Wallet(privateKey, new JsonRpcProvider(l2RpcURL));
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
