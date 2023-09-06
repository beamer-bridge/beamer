import { getNetworkId } from "../../common/network";
import { createRelayer } from "../../services/relayer/map";
import type { BaseRelayerService, TransactionHash } from "../../services/types";

export type ProgramOptions = {
  l1RpcUrl: string;
  l2RelayFromRpcUrl: string;
  l2RelayToRpcUrl: string;
  keystoreFile: string;
  password: string;
  l2TransactionHash: TransactionHash;
  networkFrom?: string;
  networkTo?: string;
};

export class RelayerProgram {
  constructor(
    readonly l2RelayerFrom: BaseRelayerService,
    readonly l2RelayerTo: BaseRelayerService,
    readonly l2TransactionHash: TransactionHash,
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

  static async createFromArgs(options: ProgramOptions): Promise<RelayerProgram> {
    const fromL2ChainId = await getNetworkId(options.l2RelayFromRpcUrl);
    const toL2ChainId = await getNetworkId(options.l2RelayToRpcUrl);
    const l1ChainId = await getNetworkId(options.l1RpcUrl);

    const relayerFrom = createRelayer(fromL2ChainId, [
      options.l1RpcUrl,
      options.l2RelayFromRpcUrl,
      options.keystoreFile,
      options.password,
      l1ChainId,
      fromL2ChainId,
      toL2ChainId,
      options.networkFrom,
    ]);
    const relayerTo = createRelayer(toL2ChainId, [
      options.l1RpcUrl,
      options.l2RelayToRpcUrl,
      options.keystoreFile,
      options.password,
      l1ChainId,
      toL2ChainId,
      fromL2ChainId,
      options.networkTo,
    ]);

    return new this(relayerFrom, relayerTo, options.l2TransactionHash);
  }

  async run(): Promise<void> {
    const relayStepCompleted = await this.l2RelayerFrom.relayTxToL1Step.isCompleted(
      this.l2TransactionHash,
    );
    let l1TransactionHash: string;

    if (relayStepCompleted) {
      l1TransactionHash = await this.l2RelayerFrom.relayTxToL1Step.recoverL1TransactionHash(
        this.l2TransactionHash,
      );
    } else {
      if (this.l2RelayerTo.prepareStep) {
        const prepareStepCompleted = await this.l2RelayerTo.prepareStep.isCompleted();

        if (!prepareStepCompleted) {
          await this.l2RelayerTo.prepareStep.execute();
        }
      }

      l1TransactionHash = await this.l2RelayerFrom.relayTxToL1Step.execute(this.l2TransactionHash);
    }

    if (this.l2RelayerTo.finalizeStep) {
      const finalizeStepCompleted = await this.l2RelayerTo.finalizeStep.isCompleted(
        l1TransactionHash,
      );

      if (!finalizeStepCompleted) {
        await this.l2RelayerTo.finalizeStep.execute(l1TransactionHash);
      }
    }

    console.log(`Verifying successful relay operation...`);
    const relayParameters = await this.l2RelayerFrom.parseFillEventDataFromTxHash(
      this.l2TransactionHash,
    );
    const success = await this.l2RelayerTo.checkSuccessOnRequestManager(
      relayParameters.requestId,
      relayParameters.fillId,
    );
    if (!success) {
      throw new Error(
        "Could not find a FillInvalidatedResolved or RequestResolved event on the destination RequestManager",
      );
    }
  }
}
