import type { DeepPartial, OEContractsLike } from "@eth-optimism/sdk";
import { CrossChainMessenger, MessageReceiptStatus, MessageStatus } from "@eth-optimism/sdk";

import type { TransactionHash } from "../types";
import { BaseRelayerService } from "../types";

export class OptimismRelayerService extends BaseRelayerService {
  customNetworkContracts: DeepPartial<OEContractsLike> | undefined;
  messenger: CrossChainMessenger | undefined;

  constructor(...args: ConstructorParameters<typeof BaseRelayerService>) {
    super(...args);

    this.messenger = new CrossChainMessenger({
      l1SignerOrProvider: this.l1Wallet,
      l2SignerOrProvider: this.l2RpcProvider,
      l1ChainId: this.l1ChainId,
      l2ChainId: this.l2ChainId,
      contracts: this.customNetworkContracts ?? {},
      bedrock: true,
    });
  }

  async getMessageInTransaction(l2TransactionHash: TransactionHash) {
    const messages = await this.messenger.getMessagesByTransaction(l2TransactionHash);

    // No messages in this transaction, so there's nothing to do
    if (messages.length === 0) {
      throw new Error(`No message found in L2 transaction ${l2TransactionHash}.`);
    }
    if (messages.length > 1) {
      throw new Error(`Multiple messages found in L2 transaction ${l2TransactionHash}.`);
    }

    return messages[0];
  }

  isMessageProved(messageStatus: MessageStatus): boolean {
    return [
      MessageStatus.READY_FOR_RELAY,
      MessageStatus.RELAYED,
      MessageStatus.IN_CHALLENGE_PERIOD,
    ].includes(messageStatus);
  }

  async proveMessage(l2TransactionHash: TransactionHash) {
    console.log(`\nProving OP message on L1 for L2 Transaction hash: ${l2TransactionHash}`);

    await this.l2RpcProvider.waitForTransaction(l2TransactionHash, 1);
    const message = await this.getMessageInTransaction(l2TransactionHash);
    const status = await this.messenger.getMessageStatus(message);

    console.log(`Message status: ${MessageStatus[status]}`);
    if (this.isMessageProved(status)) {
      console.log(`Message already proven.`);
      return;
    }

    if (status !== MessageStatus.READY_TO_PROVE) {
      console.log("Message not ready to be proven. Waiting...");
    }
    await this.messenger.waitForMessageStatus(message, MessageStatus.READY_TO_PROVE);

    // Now we can prove the message on L1
    console.log("Proving message...");
    const tx = await this.messenger.proveMessage(message);
    const receipt = await tx.wait(1);
    if (!receipt.status) {
      throw new Error(
        `Message proving failed - transaction reverted on chain! Transaction hash: ${receipt.transactionHash}`,
      );
    }

    console.log(`Message successfully proven with L1 transaction hash: ${tx.hash}`);
    return;
  }

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l2TransactionHash: TransactionHash): Promise<TransactionHash | undefined> {
    console.log("Optimism outbox execution.");

    await this.l2RpcProvider.waitForTransaction(l2TransactionHash, 1);
    const message = await this.getMessageInTransaction(l2TransactionHash);
    const status = await this.messenger.getMessageStatus(message);

    console.log(`Message status: ${MessageStatus[status]}`);
    if (status === MessageStatus.RELAYED) {
      const receipt = await this.messenger.waitForMessageReceipt(message);
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
      await this.messenger.finalizeMessage(message, {
        overrides: { gasLimit: 2000000 },
      });
    } catch (err) {
      if (!err.message.includes("message has already been received.")) {
        throw err;
      } // Otherwise the message was relayed by someone else
    }

    const receipt = await this.messenger.waitForMessageReceipt(message);

    console.log(`Transaction hash: ${receipt.transactionReceipt.transactionHash}`);
    if (receipt.receiptStatus === MessageReceiptStatus.RELAYED_SUCCEEDED) {
      console.log("Message successfully relayed!");
      return receipt.transactionReceipt.transactionHash;
    } else {
      throw new Error("Message relaying failed!");
    }
  }

  async finalize(): Promise<void> {
    return;
  }
}
