import type {
  L1Network,
  L1ToL2MessageWriter,
  L2Network,
  L2ToL1MessageWriter,
} from "@arbitrum/sdk";
import {
  addCustomNetwork,
  L1ToL2MessageGasEstimator,
  L1ToL2MessageStatus,
  L1TransactionReceipt,
  L2ToL1MessageStatus,
  L2TransactionReceipt,
} from "@arbitrum/sdk";
import type { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "ethers";
import { readFileSync } from "fs";

import type { ArbitrumL1Messenger } from "../../../types-gen/contracts";
import { ArbitrumL1Messenger__factory } from "../../../types-gen/contracts";
import type { TransactionHash } from "../types";
import { BaseRelayerService, FinalizeStep, PrepareStep, RelayStep } from "../types";

const L1_CONTRACTS: Record<number, { ARBITRUM_L1_MESSENGER: string }> = {
  42161: {
    ARBITRUM_L1_MESSENGER: "0x5911621aF8826d1AAA5B8B28d63c1e0096f7c0e3",
  },
  421613: {
    ARBITRUM_L1_MESSENGER: "0x3C14BBAaC9a90b1820552Aca33Ab23724F0Da025",
  },
  412346: {
    ARBITRUM_L1_MESSENGER: process.env.ARBITRUM_L1_MESSENGER || "",
  },
};

export class ArbitrumRelayerService extends BaseRelayerService {
  static readonly MAX_MESSAGE_LENGTH_BYTES = 5_000;

  prepareStep = new PrepareStep(
    async () => await this.prepare(),
    async () => await this.isPrepareCompleted(),
  );
  relayTxToL1Step = new RelayStep(
    async (l2TransactionHash) => await this.relayTxToL1(l2TransactionHash),
    async (l2TransactionHash) => await this.isRelayCompleted(l2TransactionHash),
    async (l2TransactionHash) => await this.recoverL1TransactionHash(l2TransactionHash),
  );
  finalizeStep = new FinalizeStep(
    async (l1TransactionHash) => await this.finalize(l1TransactionHash),
    async (l1TransactionHash) => await this.isFinalizeCompleted(l1TransactionHash),
  );

  private arbitrumL1Messenger: ArbitrumL1Messenger;

  constructor(...args: ConstructorParameters<typeof BaseRelayerService>) {
    super(...args);

    const arbitrumMessengerAddress = L1_CONTRACTS[this.l2ChainId].ARBITRUM_L1_MESSENGER;
    this.arbitrumL1Messenger = ArbitrumL1Messenger__factory.connect(
      arbitrumMessengerAddress,
      this.l1Wallet,
    );
  }

  private async getDeltaSubmissionFee(): Promise<BigNumber> {
    const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(this.l2RpcProvider);
    const submissionFee = await l1ToL2MessageGasEstimate.estimateSubmissionFee(
      this.l1RpcProvider,
      BigNumber.from(0),
      BigNumber.from(ArbitrumRelayerService.MAX_MESSAGE_LENGTH_BYTES),
    );
    const deltaSubmissionFee = submissionFee.mul(110).div(100); // We add 10% on top to ensure that the creation of a retryable ticket doesn't fail

    return deltaSubmissionFee;
  }

  private async isPrepareCompleted(): Promise<boolean> {
    const deltaSubmissionFee = await this.getDeltaSubmissionFee();

    const currentDeposit: BigNumber = await this.arbitrumL1Messenger.deposits(
      this.l1Wallet.address,
    );

    return currentDeposit.gte(deltaSubmissionFee);
  }

  private async prepare(): Promise<void> {
    const deltaSubmissionFee = await this.getDeltaSubmissionFee();

    console.log("Preparing Arbitrum Messenger for forwarding the L1 message...");

    // ArbitrumL1Messenger refunds the rest of the deposit automatically
    // after relaying a message by calling `ArbitrumL1Messenger.sendMessage`.
    const estimatedGasLimit = await this.arbitrumL1Messenger.estimateGas.deposit({
      value: deltaSubmissionFee,
    });

    const transaction = await this.arbitrumL1Messenger.deposit({
      gasLimit: estimatedGasLimit,
      value: deltaSubmissionFee,
    });

    const receipt = await transaction.wait(1);

    if (receipt && receipt.status) {
      console.log(
        `Successfully deposited funds on ArbitrumL1Messenger: ${receipt.transactionHash}`,
      );
      return;
    } else {
      throw new Error("Arbitrum L1 deposit transaction reverted on chain.");
    }
  }

  private async getL2ToL1Message(
    l2TransactionHash: TransactionHash,
  ): Promise<L2ToL1MessageWriter> {
    /**
     * First, let's find the Arbitrum txn from the txn hash provided
     */
    const receipt = await this.l2RpcProvider.getTransactionReceipt(l2TransactionHash);
    if (!receipt) {
      throw new Error(`Transaction "${l2TransactionHash}" cannot be found on Arbitrum...`);
    }
    const l2Receipt = new L2TransactionReceipt(receipt);

    /**
     * Note that in principle, a single transaction could trigger any number of outgoing messages;
     * The common case for beamer however, will be only 1 message per transaction.
     */
    const messages = await l2Receipt.getL2ToL1Messages<Signer>(this.l1Wallet);
    const l2ToL1Msg = messages[0];
    return l2ToL1Msg;
  }

  private async isRelayCompleted(l2TransactionHash: TransactionHash): Promise<boolean> {
    const l2ToL1Message = await this.getL2ToL1Message(l2TransactionHash);
    return (await l2ToL1Message.status(this.l2RpcProvider)) === L2ToL1MessageStatus.EXECUTED;
  }

  private async recoverL1TransactionHash(
    l2TransactionHash: TransactionHash,
  ): Promise<TransactionHash> {
    const parameters = await this.parseFillEventDataFromTxHash(l2TransactionHash);
    const transactionHash = await this.findL1TransactionHashForMessage(
      parameters.requestId,
      parameters.fillId,
      parameters.sourceChainId,
      parameters.filler,
      BigNumber.from(this.l2ChainId),
    );
    if (!transactionHash) {
      throw new Error(
        `The L1 transaction hash of the related message cannot be recovered. \n
        Did you properly configure the ArbitrumL2Messenger contract address & Resolver's deployed block number?`,
      );
    }
    console.log(`Message has already been relayed with tx hash: ${transactionHash}.\n`);
    return transactionHash;
  }

  private async relayTxToL1(l2TransactionHash: TransactionHash): Promise<string> {
    console.log("Arbitrum outbox execution");
    const l2ToL1Message = await this.getL2ToL1Message(l2TransactionHash);

    /**
     * before we try to execute out message, we need to make sure the l2 block it's included in is confirmed!
     * (It can only be confirmed after the dispute period; Arbitrum is an optimistic rollup after-all)
     * waitUntilReadyToExecute() waits until the item outbox entry exists
     */
    const timeToWaitMs = 1000 * 60;
    console.log("Waiting for outbox entry to show up...");
    await l2ToL1Message.waitUntilReadyToExecute(this.l2RpcProvider, timeToWaitMs);

    /**
     * Now that its confirmed and not executed, we can execute our message in its outbox entry.
     */
    console.log("Outbox entry found! Executing it...");

    const l1Transaction = await l2ToL1Message.execute(this.l2RpcProvider);
    const l1Receipt = await l1Transaction.wait();

    console.log("Done! Your transaction is executed ", l1Receipt.transactionHash);

    return l1Receipt.transactionHash;
  }

  private async getL1ToL2Message(
    l1TransactionHash: TransactionHash,
  ): Promise<L1ToL2MessageWriter> {
    const l1TransactionReceipt = await this.l1RpcProvider.getTransactionReceipt(l1TransactionHash);
    if (!l1TransactionReceipt) {
      throw new Error(`Transaction "${l1TransactionHash}" cannot be found on L1...`);
    }

    /**
     * In principle, a single L1 txn can trigger any number of L1-to-L2 messages (each with its own sequencer number).
     * In this case, we know our txn triggered only one
     * Here, We check if our L1 to L2 message is redeemed on L2
     */
    const wrappedL1TransactionReceipt = new L1TransactionReceipt(l1TransactionReceipt);
    const messages = await wrappedL1TransactionReceipt.getL1ToL2Messages(this.l2Wallet);
    const message = messages[0];
    return message;
  }

  private async isFinalizeCompleted(l1TransactionHash: string): Promise<boolean> {
    const l1ToL2Message = await this.getL1ToL2Message(l1TransactionHash);

    console.log("Waiting for L2 side. It may take 10-15 minutes ⏰⏰");
    const messageResult = await l1ToL2Message.waitForStatus();

    const status = messageResult.status;
    return status === L1ToL2MessageStatus.REDEEMED;
  }

  private async finalize(l1TransactionHash: string): Promise<void> {
    const l1ToL2Message = await this.getL1ToL2Message(l1TransactionHash);

    console.log("Finalizing message travelling to Arbitrum.");

    /**
     * We use the redeem() method from Arbitrum SDK to manually redeem our ticket
     */
    console.log("Redeeming the ticket now...");
    const l2Tx = await l1ToL2Message.redeem();
    const rec = await l2Tx.waitForRedeem();
    console.log("The L2 side of your transaction is now executed:", await rec.transactionHash);

    return;
  }

  addCustomNetwork(filePath: string) {
    const configFileContent = readFileSync(filePath, "utf-8");
    const config: CustomNetworkConfigFile = JSON.parse(configFileContent);

    try {
      addCustomNetwork({
        customL1Network: config.l1Network,
        customL2Network: config.l2Network,
      });
    } catch (ex) {
      const error = ex as Error;

      if (!error.message.includes("Network 1337 already included")) {
        throw error;
      }
    }
  }
}

type CustomNetworkConfigFile = {
  l1Network: L1Network;
  l2Network: L2Network;
};
