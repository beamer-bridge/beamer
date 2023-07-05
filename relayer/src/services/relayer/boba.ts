import type { CrossChainMessage } from "@eth-optimism/sdk-1.0.2";
import { CrossChainMessenger, MessageReceiptStatus, MessageStatus } from "@eth-optimism/sdk-1.0.2";

import type { TransactionHash } from "../types";
import { BaseRelayerService, RelayStep } from "../types";

const L1_CONTRACTS = {
  288: {
    AddressManager: "0x8376ac6C3f73a25Dd994E0b0669ca7ee0C02F089",
    L1CrossDomainMessenger: "0x6D4528d192dB72E282265D6092F4B872f9Dff69e",
    L1StandardBridge: "0xdc1664458d2f0B6090bEa60A8793A4E66c2F1c00",
    StateCommitmentChain: "0xdE7355C971A5B733fe2133753Abd7e5441d441Ec",
    CanonicalTransactionChain: "0xfBd2541e316948B259264c02f370eD088E04c3Db",
    BondManager: "0x60660e6CDEb423cf847dD11De4C473130D65b627",
  },
  2888: {
    AddressManager: "0x6FF9c8FF8F0B6a0763a3030540c21aFC721A9148",
    L1CrossDomainMessenger: "0xA6fA0867F39f3A3af7433C8A43f23bf26Efd1a48",
    L1StandardBridge: "0xDBD71249Fe60c9f9bF581b3594734E295EAfA9b2",
    StateCommitmentChain: "0x7Bb4cfa36F9F3880e18a46B74bBb9B334F6600F3",
    CanonicalTransactionChain: "0x8B0eF5250b5d6EfA877eAc15BBdfbD3C8069242F",
    BondManager: "0xF84979ADeb8D2Dd25f54cF8cBbB05C08eC188e11",
  },
};

export class BobaRelayerService extends BaseRelayerService {
  prepareStep = undefined;
  relayTxToL1Step = new RelayStep(
    async (l2TransactionHash) => await this.relayTxToL1(l2TransactionHash),
    async (l2TransactionHash) => await this.isRelayCompleted(l2TransactionHash),
    async (l2TransactionHash) => await this.recoverL1TransactionHash(l2TransactionHash),
  );
  finalizeStep = undefined;

  messenger: CrossChainMessenger;

  constructor(...args: ConstructorParameters<typeof BaseRelayerService>) {
    super(...args);

    this.messenger = new CrossChainMessenger({
      contracts: {
        l1: L1_CONTRACTS[this.l2ChainId],
      },
      l1SignerOrProvider: this.l1Wallet,
      l2SignerOrProvider: this.l2RpcProvider,
      l1ChainId: this.l1ChainId,
    });
  }

  private async getMessage(l2TransactionHash: TransactionHash): Promise<CrossChainMessage> {
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

  private async isRelayCompleted(l2TransactionHash: TransactionHash): Promise<boolean> {
    const message = await this.getMessage(l2TransactionHash);
    const status = await this.messenger.getMessageStatus(message);
    console.log(`Message status: ${MessageStatus[status]}`);
    return status === MessageStatus.RELAYED;
  }

  private async recoverL1TransactionHash(
    l2TransactionHash: TransactionHash,
  ): Promise<TransactionHash> {
    const message = await this.getMessage(l2TransactionHash);
    const status = await this.messenger.getMessageStatus(message);
    if (status !== MessageStatus.RELAYED) {
      throw new Error("Message was not relayed yet!");
    }
    const receipt = await this.messenger.waitForMessageReceipt(message);
    console.log(
      `Message already relayed with tx hash: ${receipt.transactionReceipt.transactionHash}`,
    );
    return receipt.transactionReceipt.transactionHash;
  }

  private async relayTxToL1(l2TransactionHash: TransactionHash): Promise<TransactionHash> {
    const message = await this.getMessage(l2TransactionHash);

    const status = await this.messenger.getMessageStatus(message);
    if (status !== MessageStatus.READY_FOR_RELAY) {
      throw new Error("Message not ready for relaying.");
    }

    console.log("Boba outbox execution.");

    // Now we can relay the message to L1.
    console.log("Relaying...");
    try {
      await this.messenger.finalizeMessage(message);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("message has already been received."))) {
        throw err;
      } // Otherwise the message was relayed by someone else
    }

    const receipt = await this.messenger.waitForMessageReceipt(message, { confirmations: 1 });

    console.log(`Transaction hash: ${receipt.transactionReceipt.transactionHash}`);

    if (receipt.receiptStatus === MessageReceiptStatus.RELAYED_SUCCEEDED) {
      console.log("Message successfully relayed!");
      return receipt.transactionReceipt.transactionHash;
    } else {
      throw new Error("Message relaying failed!");
    }
  }
}
