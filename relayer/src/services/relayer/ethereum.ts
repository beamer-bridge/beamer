import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";

import type { EthereumL2Messenger } from "../../../types-gen/contracts";
import { EthereumL2Messenger__factory, Resolver__factory } from "../../../types-gen/contracts";
import type { TransactionHash } from "../types";
import { BaseRelayerService, RelayStep } from "../types";

const L1_CONTRACTS: Record<number, { ETHEREUM_L2_MESSENGER: string }> = {
  1: {
    ETHEREUM_L2_MESSENGER: "0x3222C9a1e5d7856FCBc551A30a63634e7Fd634Da",
  },
  5: {
    ETHEREUM_L2_MESSENGER: "0x6064A4d69D6535981F1091Fa2243d9a106046e46",
  },
  1337: {
    ETHEREUM_L2_MESSENGER: process.env.ETHEREUM_L2_MESSENGER || "",
  },
};

export class EthereumRelayerService extends BaseRelayerService {
  prepareStep = undefined;
  relayTxToL1Step = new RelayStep(
    async (l2TransactionHash) => await this.relayTxToL1(l2TransactionHash),
    async (l2TransactionHash) => await this.isRelayCompleted(l2TransactionHash),
    async (l2TransactionHash) => await this.recoverL1TransactionHash(l2TransactionHash),
  );
  finalizeStep = undefined;

  messenger: EthereumL2Messenger;

  constructor(...args: ConstructorParameters<typeof BaseRelayerService>) {
    super(...args);

    const ethereumMessengerAddress = L1_CONTRACTS[this.l2ChainId].ETHEREUM_L2_MESSENGER;
    this.messenger = EthereumL2Messenger__factory.connect(ethereumMessengerAddress, this.l2Wallet);
  }

  private createMessageHash(
    requestId: string,
    fillId: string,
    sourceChainId: BigNumber,
    filler: string,
    fillChainId: BigNumber,
  ): string {
    const contractInterface = Resolver__factory.createInterface();
    const encodedCall = contractInterface.encodeFunctionData("resolve", [
      requestId,
      fillId,
      fillChainId,
      sourceChainId,
      filler,
    ]);

    return keccak256(encodedCall);
  }

  private async isRelayCompleted(l1TransactionHash: TransactionHash): Promise<boolean> {
    const callParameters = await this.parseFillEventDataFromTxHash(l1TransactionHash);

    const l2ChainId = await this.getL2ChainId();
    const parameters = [
      callParameters.requestId,
      callParameters.fillId,
      callParameters.sourceChainId,
      callParameters.filler,
    ] as const;

    const messageHash = this.createMessageHash(...parameters, BigNumber.from(l2ChainId));
    const storedMessageHashStatus = await this.messenger.messageHashes(messageHash);
    const isMessageRelayed = storedMessageHashStatus == 2;

    return isMessageRelayed;
  }

  private async recoverL1TransactionHash(
    l1TransactionHash: TransactionHash,
  ): Promise<TransactionHash> {
    const callParameters = await this.parseFillEventDataFromTxHash(l1TransactionHash);

    const l2ChainId = await this.getL2ChainId();
    const parameters = [
      callParameters.requestId,
      callParameters.fillId,
      callParameters.sourceChainId,
      callParameters.filler,
    ] as const;

    const transactionHash = await this.findL1TransactionHashForMessage(
      ...parameters,
      BigNumber.from(l2ChainId),
    );
    if (!transactionHash) {
      throw new Error(
        `The L1 transaction hash of the related message cannot be recovered. \n
        Did you properly configure the EthereumL2Messenger contract address & Resolver's deployed block number?`,
      );
    }
    console.log(`Message has already been relayed with tx hash: ${transactionHash}.\n`);
    return transactionHash;
  }

  private async relayTxToL1(l1TransactionHash: TransactionHash): Promise<TransactionHash> {
    const callParameters = await this.parseFillEventDataFromTxHash(l1TransactionHash);

    console.log("Ethereum execution");

    const parameters = [
      callParameters.requestId,
      callParameters.fillId,
      callParameters.sourceChainId,
      callParameters.filler,
    ] as const;

    const estimatedGasLimit = await this.messenger.estimateGas.relayMessage(...parameters);

    const transaction = await this.messenger.relayMessage(...parameters, {
      gasLimit: estimatedGasLimit,
    });
    const transactionReceipt = await transaction.wait();
    const transactionHash = transactionReceipt.transactionHash;

    console.log(`Successfully executed the message on L1. Transaction hash: ${transactionHash}\n`);
    return transactionHash;
  }
}
