import type { DeepPartial, OEContractsLike } from "@eth-optimism/sdk";
import { CrossChainMessenger, MessageReceiptStatus, MessageStatus } from "@eth-optimism/sdk";
import { readFileSync } from "fs";

import { sleep } from "../../common/util";
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
      l1ChainId: this.L1ChainId,
      l2ChainId: this.fromL2ChainId,
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

  async waitAndProveMessage(l2TransactionHash: TransactionHash): Promise<void> {
    // Loop and retry until message is READY_TO_PROVE
    try {
      const response = await this.proveMessage(l2TransactionHash);
      return response;
    } catch (e) {
      if (e.message == "Message not ready to be proven.") {
        console.log(e.message);
        console.log("Sleeping for 5s before retrying.");
        await sleep(5000);
        return this.waitAndProveMessage(l2TransactionHash);
      }
      throw e;
    }
  }

  async proveMessage(l2TransactionHash: TransactionHash) {
    console.log(`\nProving OP message on L1 for L2 Transaction hash: ${l2TransactionHash}`);

    const message = await this.getMessageInTransaction(l2TransactionHash);
    const status = await this.messenger.getMessageStatus(message);

    console.log(`Message status: ${MessageStatus[status]}`);
    if (this.isMessageProved(status)) {
      console.log(`Message already proven.`);
      return;
    }

    if (status !== MessageStatus.READY_TO_PROVE) {
      throw new Error("Message not ready to be proven.");
    }

    // Now we can prove the message on L1
    console.log("Proving message...");
    const tx = await this.messenger.proveMessage(message);
    const receipt = await tx.wait(1);
    if (!receipt.status) {
      throw new Error(
        `Message proving failed - transaction reverted on chain! Transaction hash: ${receipt.transactionHash}`,
      );
    }

    console.log("Message successfully proven!");
    return;
  }

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l2TransactionHash: TransactionHash): Promise<TransactionHash | undefined> {
    console.log("Optimism outbox execution.");

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
      await this.messenger.finalizeMessage(message);
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

  addCustomNetwork(filePath: string) {
    const configFileContent = readFileSync(filePath, "utf-8");
    const config: CustomNetworkConfigFile = JSON.parse(configFileContent);

    this.customNetworkContracts = {
      l1: {
        AddressManager: config.AddressManager,
        BondManager: config.BondManager,
        CanonicalTransactionChain: config.CanonicalTransactionChain,
        L1CrossDomainMessenger: config.Proxy__OVM_L1CrossDomainMessenger,
        L1StandardBridge: config.Proxy__OVM_L1StandardBridge,
        StateCommitmentChain: config.StateCommitmentChain,
      },
    };
  }
}

type CustomNetworkConfigFile = {
  BondManager: string;
  Proxy__OVM_L1CrossDomainMessenger: string;
  Lib_AddressManager: string;
  L1StandardBridge_for_verification_only: string;
  OVM_L1CrossDomainMessenger: string;
  ChugSplashDictator: string;
  AddressDictator: string;
  CanonicalTransactionChain: string;
  Proxy__OVM_L1StandardBridge: string;
  StateCommitmentChain: string;
  "ChainStorageContainer-SCC-batches": string;
  "ChainStorageContainer-CTC-batches": string;
  AddressManager: string;
};
