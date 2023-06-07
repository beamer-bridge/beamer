import type { DeepPartial, OEContractsLike } from "@eth-optimism/sdk";
import { CrossChainMessenger, MessageReceiptStatus, MessageStatus } from "@eth-optimism/sdk";
import { readFileSync } from "fs";

import type { TransactionHash } from "../types";
import { BaseRelayerService } from "../types";

export class OptimismRelayerService extends BaseRelayerService {
  customNetworkContracts: DeepPartial<OEContractsLike> | undefined;

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l2TransactionHash: TransactionHash): Promise<TransactionHash | undefined> {
    console.log("Optimism outbox execution.");

    const messenger = new CrossChainMessenger({
      l1SignerOrProvider: this.l1Wallet,
      l2SignerOrProvider: this.l2RpcProvider,
      l1ChainId: await this.getL1ChainId(),
      l2ChainId: await this.getL2ChainId(),
      contracts: this.customNetworkContracts ?? {},
      bedrock: true,
    });

    const messages = await messenger.getMessagesByTransaction(l2TransactionHash);

    // No messages in this transaction, so there's nothing to do
    if (messages.length === 0) {
      throw new Error(`No message found in L2 transaction ${l2TransactionHash}.`);
    }
    if (messages.length > 1) {
      throw new Error(`Multiple messages found in L2 transaction ${l2TransactionHash}.`);
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

  async finalize(): Promise<void> {
    return;
  }

  async addCustomNetwork(filePath: string) {
    const configFileContent = await readFileSync(filePath, "utf-8");
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
