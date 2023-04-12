import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";

import type { EthereumL2Messenger } from "../../../types-gen/contracts";
import { EthereumL2Messenger__factory, Resolver__factory } from "../../../types-gen/contracts";
import type { TypedEvent, TypedEventFilter } from "../../../types-gen/contracts/common";
import { parseFillInvalidatedEvent } from "../../common/events/FillInvalidated";
import { parseRequestFilledEvent } from "../../common/events/RequestFilled";
import type { TransactionHash } from "../types";
import { BaseRelayerService, RelayStep } from "../types";

type RelayCallParams = {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  filler: string;
};

const L1_CONTRACTS: Record<
  number,
  { ETHEREUM_L2_MESSENGER: string; RESOLVER_DEPLOY_BLOCK_NUMBER: number }
> = {
  1: {
    ETHEREUM_L2_MESSENGER: "0x3222C9a1e5d7856FCBc551A30a63634e7Fd634Da",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 16946576,
  },
  5: {
    ETHEREUM_L2_MESSENGER: "0x6064A4d69D6535981F1091Fa2243d9a106046e46",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 9066315,
  },
  1337: {
    ETHEREUM_L2_MESSENGER: process.env.ETHEREUM_L2_MESSENGER || "",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 0,
  },
};

const FILTER_BLOCKS_PER_ITERATION = 5000;

export class EthereumRelayerService extends BaseRelayerService {
  prepareStep = undefined;
  relayTxToL1Step = new RelayStep(
    async (l2TransactionHash) => await this.relayTxToL1(l2TransactionHash),
    async (l2TransactionHash) => await this.isRelayCompleted(l2TransactionHash),
  );
  finalizeStep = undefined;

  messenger: EthereumL2Messenger;

  constructor(...args: ConstructorParameters<typeof BaseRelayerService>) {
    super(...args);

    const ethereumMessengerAddress = L1_CONTRACTS[this.l2ChainId].ETHEREUM_L2_MESSENGER;
    this.messenger = EthereumL2Messenger__factory.connect(ethereumMessengerAddress, this.l2Wallet);
  }

  async parseEventDataFromTxHash(
    l1TransactionHash: TransactionHash,
  ): Promise<RelayCallParams | null> {
    const receipt = await this.l2RpcProvider.getTransactionReceipt(l1TransactionHash);

    if (!receipt) {
      throw new Error(`Transaction "${l1TransactionHash}" cannot be found on Ethereum...`);
    }

    const requestFilledEvent = parseRequestFilledEvent(receipt.logs);

    if (requestFilledEvent) {
      return {
        requestId: requestFilledEvent.requestId,
        fillId: requestFilledEvent.fillId,
        sourceChainId: requestFilledEvent.sourceChainId,
        filler: requestFilledEvent.filler,
      };
    }

    const fillInvalidatedEvent = parseFillInvalidatedEvent(receipt.logs);

    if (fillInvalidatedEvent && this.destinationChainId) {
      return {
        ...fillInvalidatedEvent,
        sourceChainId: BigNumber.from(this.destinationChainId),
        filler: "0x0000000000000000000000000000000000000000",
      };
    }

    return null;
  }

  private async findTransactionHashForMessage(
    requestId: string,
    fillId: string,
    sourceChainId: BigNumber,
    filler: string,
    fillChainId: BigNumber,
    resolverAddress: string,
  ): Promise<string | undefined> {
    const resolver = Resolver__factory.connect(resolverAddress, this.l1Wallet);
    const currentBlock = await this.l1Wallet.provider.getBlock("latest");
    const resolverDeployBlockNumber = L1_CONTRACTS[this.l1ChainId].RESOLVER_DEPLOY_BLOCK_NUMBER;
    let currentBlockNumber = currentBlock.number;

    while (currentBlockNumber > resolverDeployBlockNumber) {
      const events = await resolver.queryFilter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "Resolution" as TypedEventFilter<TypedEvent<any, any>>,
        currentBlockNumber - FILTER_BLOCKS_PER_ITERATION,
        currentBlockNumber,
      );

      for (const event of events) {
        if (event.event === "Resolution") {
          const args = event.args;

          if (
            sourceChainId.eq(args.sourceChainId) &&
            fillChainId.eq(args.fillChainId) &&
            args.requestId === requestId &&
            args.filler === filler &&
            args.fillId === fillId
          ) {
            return event.transactionHash;
          }
        }
      }
      currentBlockNumber -= FILTER_BLOCKS_PER_ITERATION;
    }

    return undefined;
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

  private async getCallParameters(l1TransactionHash: TransactionHash): Promise<RelayCallParams> {
    const callParameters = await this.parseEventDataFromTxHash(l1TransactionHash);
    if (!callParameters) {
      throw new Error(
        "Couldn't find a matching event (RequestFilled | FillInvalidated) in the transaction logs.",
      );
    }
    return callParameters;
  }

  private async isRelayCompleted(
    l1TransactionHash: TransactionHash,
  ): Promise<TransactionHash | false> {
    const callParameters = await this.getCallParameters(l1TransactionHash);

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

    if (isMessageRelayed) {
      console.log("Message has already been relayed..");

      const resolverAddress = await this.messenger.resolver();
      const transactionHash = await this.findTransactionHashForMessage(
        ...parameters,
        BigNumber.from(l2ChainId),
        resolverAddress,
      );
      if (!transactionHash) {
        throw new Error(
          `Message has already been relayed but the related L1 transaction hash cannot be found. \n
          Did you properly configure the EthereumL2Messenger contract address & Resolver's deployed block number?`,
        );
      }
      console.log(`Message has already been relayed with tx hash: ${transactionHash}.\n`);
      return transactionHash;
    }

    return false;
  }

  private async relayTxToL1(l1TransactionHash: TransactionHash): Promise<TransactionHash> {
    const callParameters = await this.getCallParameters(l1TransactionHash);

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
