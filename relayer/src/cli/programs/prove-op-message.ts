import { getNetworkId } from "../../common/network";
import { OptimismRelayerService } from "../../services/";

export type ProgramOptions = {
  l1RpcUrl: string;
  l2RpcUrl: string;
  walletPrivateKey: string;
  l2TransactionHash: string;
  customNetwork?: string;
};

export class OPMessageProverProgram {
  constructor(
    readonly l2RelayerFrom: OptimismRelayerService,
    readonly l2TransactionHash: string,
  ) {}

  static validateArgs(args: ProgramOptions): Array<string> {
    const validationErrors: string[] = [];

    if (!args.l2TransactionHash.startsWith("0x") || args.l2TransactionHash.trim().length != 66) {
      validationErrors.push(
        `Invalid argument value for "--l2-transaction-hash": "${args.l2TransactionHash}" doesn't look like a txn hash...`,
      );
    }

    return validationErrors;
  }

  static async createFromArgs(options: ProgramOptions): Promise<OPMessageProverProgram> {
    const l2ChainId = await getNetworkId(options.l2RpcUrl);
    const l1ChainId = await getNetworkId(options.l1RpcUrl);

    const OPRelayer = new OptimismRelayerService(
      options.l1RpcUrl,
      options.l2RpcUrl,
      options.walletPrivateKey,
      l1ChainId,
      l2ChainId,
      undefined,
      options.customNetwork,
    );

    return new this(OPRelayer, options.l2TransactionHash);
  }

  async run(): Promise<void> {
    await this.l2RelayerFrom.proveMessage(this.l2TransactionHash);
  }
}
