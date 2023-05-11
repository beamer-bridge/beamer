import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";

import { EthereumL2Messenger__factory, Resolver__factory } from "../../types-gen/contracts";
import { parseFillInvalidatedEvent } from "../common/events/FillInvalidated";
import { parseRequestFilledEvent } from "../common/events/RequestFilled";
import { addresses, contractsMeta } from "../deployments";
import type { TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

type RelayCallParams = {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  filler: string;
};

const CONTRACTS_DATA: Record<
  number,
  { ETHEREUM_L2_MESSENGER: string; RESOLVER_DEPLOY_BLOCK_NUMBER: number }
> = {
  1: {
    ETHEREUM_L2_MESSENGER: addresses.mainnet.EthereumL2Messenger,
    RESOLVER_DEPLOY_BLOCK_NUMBER: contractsMeta.mainnet.RESOLVER_DEPLOY_BLOCK_NUMBER,
  },
  5: {
    ETHEREUM_L2_MESSENGER: addresses.goerli.EthereumL2Messenger,
    RESOLVER_DEPLOY_BLOCK_NUMBER: contractsMeta.goerli.RESOLVER_DEPLOY_BLOCK_NUMBER,
  },
  1337: {
    ETHEREUM_L2_MESSENGER: process.env.ETHEREUM_L2_MESSENGER || "",
    RESOLVER_DEPLOY_BLOCK_NUMBER: process.env.RESOLVER_DEPLOY_BLOCK_NUMBER
      ? parseInt(process.env.RESOLVER_DEPLOY_BLOCK_NUMBER)
      : 0,
  },
};

const FILTER_BLOCKS_PER_ITERATION = 5000;

export class EthereumRelayerService extends BaseRelayerService {
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

    if (fillInvalidatedEvent) {
      return {
        ...fillInvalidatedEvent,
        sourceChainId: BigNumber.from(this.toL2ChainId),
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
  ): Promise<string | null> {
    const resolver = Resolver__factory.connect(resolverAddress, this.l1Wallet);
    const currentBlock = await this.l1Wallet.provider.getBlock("latest");
    let currentBlockNumber = currentBlock.number;
    const resolverDeployBlockNumber =
      CONTRACTS_DATA[await this.getL1ChainId()].RESOLVER_DEPLOY_BLOCK_NUMBER;

    while (currentBlockNumber > resolverDeployBlockNumber) {
      const events = await resolver.queryFilter(
        "Resolution" as unknown,
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

    return null;
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

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l1TransactionHash: TransactionHash): Promise<string | undefined> {
    console.log("\nExecuting message on Ethereum L1.");

    const callParameters = await this.parseEventDataFromTxHash(l1TransactionHash);

    if (!callParameters) {
      throw new Error(
        "Couldn't find a matching event (RequestFilled | FillInvalidated) in the transaction logs.",
      );
    }

    console.log("Found matching event. Proceeding with the next steps...");

    // Execute EthereumL2Messenger.relayMessage
    const l2ChainId = await this.getL2ChainId();
    const ethereumMessengerAddress = CONTRACTS_DATA[l2ChainId].ETHEREUM_L2_MESSENGER;
    const ethereumMessenger = EthereumL2Messenger__factory.connect(
      ethereumMessengerAddress,
      this.l2Wallet,
    );

    const parameters = [
      callParameters.requestId,
      callParameters.fillId,
      callParameters.sourceChainId,
      callParameters.filler,
    ] as const;

    const messageHash = this.createMessageHash(...parameters, BigNumber.from(l2ChainId));
    const storedMessageHashStatus = await ethereumMessenger.messageHashes(messageHash);
    const isMessageRelayed = storedMessageHashStatus == 2;

    if (isMessageRelayed) {
      const resolverAddress = await ethereumMessenger.resolver();
      const transactionHash = await this.findTransactionHashForMessage(
        ...parameters,
        BigNumber.from(l2ChainId),
        resolverAddress,
      );

      if (transactionHash) {
        console.log(`Message has already been relayed with tx hash: ${transactionHash}.\n`);
        return transactionHash;
      } else {
        throw new Error(
          `Message has already been relayed but the related L1 transaction hash cannot be found. \n
          Did you properly configure the EthereumL2Messenger contract address & Resolver's deployed block number?`,
        );
      }
    }

    const estimatedGasLimit = await ethereumMessenger.estimateGas.relayMessage(...parameters);

    const transaction = await ethereumMessenger.relayMessage(...parameters, {
      gasLimit: estimatedGasLimit,
    });
    const transactionReceipt = await transaction.wait();
    const transactionHash = transactionReceipt.transactionHash;

    console.log(`Successfully executed the message on L1. Transaction hash: ${transactionHash}\n`);
    return transactionHash;
  }

  async finalize(): Promise<void> {
    return;
  }
}
