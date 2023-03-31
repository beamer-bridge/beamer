import { BigNumber } from "ethers";

import { parseFillInvalidatedEvent } from "@/common/events/FillInvalidated";

import { EthereumL2Messenger__factory } from "../../types-gen/contracts";
import { parseRequestFilledEvent } from "../common/events/RequestFilled";
import type { TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

type RelayCallParams = {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  filler: string;
};

const L1_CONTRACTS: Record<number, { ETHEREUM_L2_MESSENGER: string }> = {
  1: {
    ETHEREUM_L2_MESSENGER: "",
  },
  5: {
    ETHEREUM_L2_MESSENGER: "",
  },
  1337: {
    ETHEREUM_L2_MESSENGER: process.env.ETHEREUM_L2_MESSENGER || "",
  },
};

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

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l1TransactionHash: TransactionHash): Promise<string | undefined> {
    console.log("Ethereum execution");

    const callParameters = await this.parseEventDataFromTxHash(l1TransactionHash);

    if (!callParameters) {
      throw new Error("Couldn't find a matching event in transaction logs.");
    }

    // Execute EthereumL2Messenger.relayMessage
    const ethereumMessengerAddress = L1_CONTRACTS[await this.getL2ChainId()].ETHEREUM_L2_MESSENGER;
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

    const estimatedGasLimit = await ethereumMessenger.estimateGas.relayMessage(...parameters);

    const transaction = await ethereumMessenger.relayMessage(...parameters, {
      gasLimit: estimatedGasLimit,
    });

    return transaction.hash;
  }

  async finalize(): Promise<void> {
    return;
  }
}
