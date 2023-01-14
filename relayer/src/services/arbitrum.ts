import {
  L1ToL2MessageGasEstimator,
  L1ToL2MessageStatus,
  L1TransactionReceipt,
  L2ToL1MessageStatus,
  L2TransactionReceipt,
} from "@arbitrum/sdk";
import type { Signer } from "@ethersproject/abstract-signer";
import { BigNumber, Contract } from "ethers";

import ArbitrumL1MessengerABI from "../assets/abi/ArbitrumL1Messenger.json";
import type { TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

const L1_CONTRACTS: Record<number, { ARBITRUM_L1_MESSENGER: string }> = {
  42161: {
    ARBITRUM_L1_MESSENGER: "0x7230a5D821Bd00453344b750dff43FAC754A519E",
  },
  421613: {
    ARBITRUM_L1_MESSENGER: "0xaD6DA69BB841028CEb4c9bC5efa8a07E41FD67E5",
  },
};

export class ArbitrumRelayerService extends BaseRelayerService {
  static readonly MAX_MESSAGE_LENGTH_BYTES = 5_000;

  async prepare(): Promise<boolean> {
    console.log("Preparing Arbitrum Messenger for forwarding the L1 message...");

    const arbitrumL1Messenger = new Contract(
      L1_CONTRACTS[await this.getL2ChainId()].ARBITRUM_L1_MESSENGER,
      ArbitrumL1MessengerABI,
      this.l1Wallet,
    );

    const currentDeposit: BigNumber = await arbitrumL1Messenger.deposits(this.l1Wallet.address);
    const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(this.l2RpcProvider);

    const submissionFee = await l1ToL2MessageGasEstimate.estimateSubmissionFee(
      this.l1RpcProvider,
      BigNumber.from(0),
      BigNumber.from(ArbitrumRelayerService.MAX_MESSAGE_LENGTH_BYTES),
    );

    const deltaSubmissionFee = submissionFee.mul(110).div(100); // We add 10% on top to ensure that the creation of a retryable ticket doesn't fail

    // We want to make sure that the deposited amount is always in the range [deltaSubmissionFee(MAX_MESSAGE_LENGTH_BYTES), 2 * delateSubmissionFee(MAX_MESSAGE_LENGTH_BYTES)]
    // in order to avoid depositing often
    if (currentDeposit.lte(deltaSubmissionFee)) {
      const estimatedGasLimit = await arbitrumL1Messenger.estimateGas.deposit({
        value: deltaSubmissionFee,
      });

      const transaction = await arbitrumL1Messenger.deposit({
        gasLimit: estimatedGasLimit,
        value: deltaSubmissionFee,
      });

      await transaction.wait();

      const receipt = await arbitrumL1Messenger.provider.waitForTransaction(transaction.hash, 1);

      console.log(
        `Successfully deposited funds on ArbitrumL1Messenger: ${receipt.transactionHash}`,
      );
    } else {
      console.log("ArbitrumL1Messenger has enough funds to proceed!");
    }

    return true;
  }

  async relayTxToL1(l2TransactionHash: TransactionHash): Promise<string | undefined> {
    console.log("Arbitrum outbox execution");

    /**
     * First, let's find the Arbitrum txn from the txn hash provided
     */
    const receipt = await this.l2RpcProvider.getTransactionReceipt(l2TransactionHash);
    if (!receipt) {
      throw new Error(`Transaction "${l2TransactionHash}" cannot be found on Arbitrum...`);
    }
    const l2Receipt = new L2TransactionReceipt(receipt);

    /**
     * Note that in principle, a single transaction could trigger any number of outgoing messages; the common case will be there's only one.
     * For the sake of this script, we assume there's only one / just grab the first one.
     */
    const messages = await l2Receipt.getL2ToL1Messages<Signer>(this.l1Wallet);
    const l2ToL1Msg = messages[0];

    /**
     * Check if already executed
     */
    if ((await l2ToL1Msg.status(this.l2RpcProvider)) == L2ToL1MessageStatus.EXECUTED) {
      console.log("Message already executed! Nothing else to do here.");
      return;
    }

    /**
     * before we try to execute out message, we need to make sure the l2 block it's included in is confirmed! (It can only be confirmed after the dispute period; Arbitrum is an optimistic rollup after-all)
     * waitUntilReadyToExecute() waits until the item outbox entry exists
     */
    const timeToWaitMs = 1000 * 60;
    console.log("Waiting for outbox entry to show up...");
    await l2ToL1Msg.waitUntilReadyToExecute(this.l2RpcProvider, timeToWaitMs);

    /**
     * Now that its confirmed and not executed, we can execute our message in its outbox entry.
     */
    console.log("Outbox entry found! Executing it...");

    const l1Transaciton = await l2ToL1Msg.execute(this.l2RpcProvider);
    const l1Receipt = await l1Transaciton.wait();

    console.log("Done! Your transaction is executed ", l1Receipt.transactionHash);

    return l1Receipt.transactionHash;
  }

  async finalize(l1TransactionHash: string): Promise<void> {
    console.log("Finalizing message travelling to Arbitrum.");
    const l1TransactionReceipt = await this.l1RpcProvider.getTransactionReceipt(l1TransactionHash);

    /**
     * In principle, a single L1 txn can trigger any number of L1-to-L2 messages (each with its own sequencer number).
     * In this case, we know our txn triggered only one
     * Here, We check if our L1 to L2 message is redeemed on L2
     */
    const wrappedL1TransactionReceipt = new L1TransactionReceipt(l1TransactionReceipt);
    const messages = await wrappedL1TransactionReceipt.getL1ToL2Messages(this.l2Wallet);
    const message = messages[0];

    console.log("Waiting for L2 side. It may take 10-15 minutes ⏰⏰");
    const messageResult = await message.waitForStatus();

    const status = messageResult.status;
    if (status === L1ToL2MessageStatus.REDEEMED) {
      console.log(`L2 retryable txn executed ${messageResult.l2TxReceipt.transactionHash}`);
      return;
    } else {
      console.log(`L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`);
      /**
       * We use the redeem() method from Arbitrum SDK to manually redeem our ticket
       */
      console.log("Redeeming the ticket now...");
      const l2Tx = await message.redeem();
      const rec = await l2Tx.waitForRedeem();
      console.log("The L2 side of your transaction is now executed:", await rec.transactionHash);
    }

    return;
  }
}
