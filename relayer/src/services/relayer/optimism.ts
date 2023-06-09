import type { CrossChainMessage, DeepPartial, OEContractsLike } from "@eth-optimism/sdk";
import {
  CrossChainMessenger,
  hashLowLevelMessage,
  MessageReceiptStatus,
  MessageStatus,
} from "@eth-optimism/sdk";

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

  private async isMessageWithdrawn(messageHash: string) {
    const OptimismPortal = this.messenger.contracts.l1.OptimismPortal.connect(this.l1Wallet);
    const isWithdrawn = await OptimismPortal.finalizedWithdrawals(messageHash);

    return isWithdrawn;
  }

  private async safeRelayMessage(message: CrossChainMessage): Promise<boolean> {
    const crossChainMessage = await this.messenger.toBedrockCrossChainMessage(message);
    const lowLevelMessage = await this.messenger.toLowLevelMessage(crossChainMessage);

    const hash = hashLowLevelMessage(lowLevelMessage);
    const isWithdrawn = await this.isMessageWithdrawn(hash);

    if (!isWithdrawn) {
      // Finalize message via OptimismPortal (it calls the L1CrossDomainMessenger internally)
      (await this.messenger.finalizeMessage(message)).wait(1);
    } else {
      // Here, the case was that OptimismPortal marked the withdrawal as finalized but the relay probably failed
      // We need to call the L1CrossDomainMessenger to relay the message for us instead of going via the OptimismPortal
      console.log("Try relaying via messenger..");

      const tx = await this.l1Wallet.sendTransaction({
        to: this.messenger.contracts.l1.L1CrossDomainMessenger.address,
        // lowLevelMessage.message contains the complete transaction data
        data: lowLevelMessage.message,
        gasLimit: 2_000_000,
      });

      await tx.wait(1);
    }

    return true;
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

    await this.safeRelayMessage(message);
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
