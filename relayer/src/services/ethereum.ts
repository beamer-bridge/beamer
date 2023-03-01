import { EthereumL2Messenger__factory } from "../../types-gen/contracts";
import { parseRequestFilledEvent } from "../common/events/RequestFilled";
import type { TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

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
  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l1TransactionHash: TransactionHash): Promise<string | undefined> {
    console.log("Ethereum execution");

    const receipt = await this.l2RpcProvider.getTransactionReceipt(l1TransactionHash);

    if (!receipt) {
      throw new Error(`Transaction "${l1TransactionHash}" cannot be found on Ethereum...`);
    }

    // Find RequestFilled event inside tx receipt logs
    const eventData = parseRequestFilledEvent(receipt.logs);

    if (!eventData) {
      throw new Error("RequestFilled event not found in logs.");
    }

    // Execute EthereumL2Messenger.relayMessage
    const ethereumMessengerAddress = L1_CONTRACTS[await this.getL2ChainId()].ETHEREUM_L2_MESSENGER;
    const ethereumMessenger = EthereumL2Messenger__factory.connect(
      ethereumMessengerAddress,
      this.l2Wallet,
    );

    const parameters = [
      eventData.requestId,
      eventData.fillId,
      eventData.sourceChainId,
      eventData.filler,
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
