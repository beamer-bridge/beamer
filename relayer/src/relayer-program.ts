import { getNetworkId } from "./common/network";
import { createRelayer } from "./map";
import type { BaseRelayerService } from "./services/types";

export type ProgramOptions = {
  l1RpcUrl: string;
  l2RelayFromRpcUrl: string;
  l2RelayToRpcUrl: string;
  walletPrivateKey: string;
  l2TransactionHash: string;
};

export function validateArgs(args: ProgramOptions): Array<string> {
  const validationErrors = [];

  if (!args.l2TransactionHash.startsWith("0x") || args.l2TransactionHash.trim().length != 66) {
    validationErrors.push(
      `Invalid argument value for "--l2-transaction-hash": "${args.l2TransactionHash}" doesn't look like a txn hash...`,
    );
  }

  return validationErrors;
}

export class RelayerProgram {
  constructor(
    readonly l2RelayerFrom: BaseRelayerService,
    readonly l2RelayerTo: BaseRelayerService,
    readonly l2TransactionHash: string,
  ) {}

  static async createFromArgs(options: ProgramOptions): Promise<RelayerProgram> {
    const fromL2ChainId = await getNetworkId(options.l2RelayFromRpcUrl);
    const toL2ChainId = await getNetworkId(options.l2RelayToRpcUrl);

    const relayerFrom = createRelayer(fromL2ChainId, [
      options.l1RpcUrl,
      options.l2RelayFromRpcUrl,
      options.walletPrivateKey,
    ]);
    const relayerTo = createRelayer(toL2ChainId, [
      options.l1RpcUrl,
      options.l2RelayToRpcUrl,
      options.walletPrivateKey,
    ]);

    return new this(relayerFrom, relayerTo, options.l2TransactionHash);
  }

  async run(): Promise<void> {
    await this.l2RelayerTo.prepare();
    const l1TransactionHash = await this.l2RelayerFrom.relayTxToL1(this.l2TransactionHash);
    if (l1TransactionHash) {
      await this.l2RelayerTo.finalize(l1TransactionHash);
    }
  }
}
