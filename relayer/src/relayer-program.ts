import type { BaseRelayerService } from "./services/types";
import { createRelayer } from "./map";
import { getNetworkId } from "./common/network";
export type ProgramOptions = {
  l1RpcURL: string;
  l2RelayFromRpcURL: string;
  l2RelayToRpcURL: string;
  walletPrivateKey: string;
  l2TransactionHash: string;
};

export class RelayerProgram {
  constructor(
    readonly l2RelayerFrom: BaseRelayerService,
    readonly l2RelayerTo: BaseRelayerService,
    readonly l2TransactionHash: string,
  ) {}

  static async createFromArgs(options: ProgramOptions): Promise<RelayerProgram> {
    const fromL2ChainId = await getNetworkId(options.l2RelayFromRpcURL);
    const toL2ChainId = await getNetworkId(options.l2RelayToRpcURL);

    const relayerFrom = createRelayer(fromL2ChainId, [
      {
        l1RpcURL: options.l1RpcURL,
        l2RpcURL: options.l2RelayFromRpcURL,
        privateKey: options.walletPrivateKey,
      },
    ]);
    const relayerTo = createRelayer(toL2ChainId, [
      {
        l1RpcURL: options.l1RpcURL,
        l2RpcURL: options.l2RelayToRpcURL,
        privateKey: options.walletPrivateKey,
      },
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
