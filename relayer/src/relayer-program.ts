import { getNetworkId } from "./common/network";
import { createRelayer } from "./map";
import type { BaseRelayerService, Options } from "./services/types";

export type ProgramOptions = Options & {
  l1RpcUrl: string;
  relayFromRpcUrl: string;
  relayToRpcUrl: string;
  walletPrivateKey: string;
  networkFrom?: string;
  networkTo?: string;
};

export class RelayerProgram {
  constructor(
    readonly l2RelayerFrom: BaseRelayerService,
    readonly l2RelayerTo: BaseRelayerService,
  ) {}

  static async createFromArgs(args: ProgramOptions): Promise<RelayerProgram> {
    const fromL2ChainId = await getNetworkId(args.relayFromRpcUrl);
    const toL2ChainId = await getNetworkId(args.relayToRpcUrl);

    const relayerFrom = createRelayer(fromL2ChainId, [
      args.l1RpcUrl,
      args.relayFromRpcUrl,
      args.walletPrivateKey,
    ]);
    const relayerTo = createRelayer(toL2ChainId, [
      args.l1RpcUrl,
      args.relayToRpcUrl,
      args.walletPrivateKey,
    ]);

    relayerFrom.configure(args);

    return new this(relayerFrom, relayerTo);
  }

  async run(): Promise<void> {
    await this.l2RelayerTo.prepareRelay();
    const l1TransactionHash = await this.l2RelayerFrom.relayTxToL1();
    if (l1TransactionHash) {
      await this.l2RelayerTo.finalizeRelay(l1TransactionHash);
    }
  }
}
