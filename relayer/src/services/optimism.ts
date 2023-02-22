import { CrossChainMessenger, MessageReceiptStatus, MessageStatus } from "@eth-optimism/sdk";
import { Option } from "commander";

import type { Options, TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

type OptimismOptions = {
  l2TransactionHash: TransactionHash;
};

function isValidOptimismOptions(options: Options): options is OptimismOptions {
  return (options as OptimismOptions).l2TransactionHash !== undefined;
}

export class OptimismRelayerService extends BaseRelayerService {
  static readonly CLI_OPTIONS = [
    new Option(
      "--l2-transaction-hash <URL>",
      "RPC Provider URL for layer 1",
    ).makeOptionMandatory(),
  ];

  options: OptimismOptions;

  configure(options: Options): void {
    if (!isValidOptimismOptions(options)) {
      console.error("Missing arguments for Optimism relayer service.");
      process.exit(1);
    }

    this.options = options;
  }

  async prepareRelay(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(): Promise<TransactionHash | undefined> {
    console.log("Optimism outbox execution.");

    const messenger = new CrossChainMessenger({
      l1SignerOrProvider: this.l1Wallet,
      l2SignerOrProvider: this.l2RpcProvider,
      l1ChainId: await this.getL1ChainId(),
      l2ChainId: await this.getL2ChainId(),
    });

    const messages = await messenger.getMessagesByTransaction(this.options.l2TransactionHash);

    // No messages in this transaction, so there's nothing to do
    if (messages.length === 0) {
      throw new Error(`No message found in L2 transaction ${this.options.l2TransactionHash}.`);
    }
    if (messages.length > 1) {
      throw new Error(
        `Multiple messages found in L2 transaction ${this.options.l2TransactionHash}.`,
      );
    }

    const message = messages[0];
    const status = await messenger.getMessageStatus(message);

    console.log(`Message status: ${MessageStatus[status]}`);
    if (status === MessageStatus.RELAYED) {
      const receipt = await messenger.waitForMessageReceipt(message);
      console.log(
        `Message already relayed with tx hash: ${receipt.transactionReceipt.transactionHash}`,
      );
      return receipt.transactionReceipt.transactionHash;
    }

    if (status !== MessageStatus.READY_FOR_RELAY) {
      throw new Error("Message not ready for relaying.");
    }

    // Now we can relay the message to L1.
    console.log("Relaying...");
    try {
      await messenger.finalizeMessage(message);
    } catch (err) {
      if (!err.message.includes("message has already been received.")) {
        throw err;
      } // Otherwise the message was relayed by someone else
    }

    const receipt = await messenger.waitForMessageReceipt(message);

    console.log(`Transaction hash: ${receipt.transactionReceipt.transactionHash}`);
    if (receipt.receiptStatus === MessageReceiptStatus.RELAYED_SUCCEEDED) {
      console.log("Message successfully relayed!");
      return receipt.transactionReceipt.transactionHash;
    } else {
      throw new Error("Message relaying failed!");
    }
  }

  async finalizeRelay(): Promise<void> {
    return;
  }
}
