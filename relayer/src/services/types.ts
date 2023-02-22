import type { Provider } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import type { Option } from "commander";
import { Wallet } from "ethers";

import type {
  ArbitrumRelayerService,
  BobaRelayerService,
  EthereumRelayerService,
  OptimismRelayerService,
} from "./";

export type TransactionHash = string;

export type ExtendedRelayerService =
  | typeof ArbitrumRelayerService
  | typeof BobaRelayerService
  | typeof OptimismRelayerService
  | typeof EthereumRelayerService;

export type Options = Record<string, unknown>;

export abstract class BaseRelayerService {
  static readonly CLI_OPTIONS: Array<Option> = [];

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addCustomNetwork(_filePath: string): void {
    return;
  }

  abstract configure(options: Record<string, unknown>): void;
  abstract prepareRelay(): Promise<boolean>;
  abstract relayTxToL1(): Promise<TransactionHash | undefined>;
  abstract finalizeRelay(l1TransactionHash: TransactionHash): Promise<void>;
}
