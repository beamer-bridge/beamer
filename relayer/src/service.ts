import type { Signer } from "ethers";
import { BaseServiceV2, validators } from "@eth-optimism/common-ts";
import { getChainId } from "@eth-optimism/core-utils";
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";
import type { Provider } from "@ethersproject/abstract-provider";
import { ppid } from "process";

type MessageRelayerOptions = {
  l1RpcProvider: Provider
  l2RpcProvider: Provider
  l1Wallet: Signer
  fromL2TransactionHash: string
}

type MessageRelayerState = {
  wallet: Signer
  messenger: CrossChainMessenger
  l2TxBlockNumber: number
}

const optionsSpec = {
  l1RpcProvider: {
    validator: validators.provider,
    desc: "Provider for interacting with L1.",
  },
  l2RpcProvider: {
    validator: validators.provider,
    desc: "Provider for interacting with L2.",
  },
  l1Wallet: {
    validator: validators.wallet,
    desc: "Wallet used to interact with L1.",
  },
  fromL2TransactionHash: {
    validator: validators.str,
    desc: "Index of the first L2 transaction to start processing from.",
  },
};

export class MessageRelayerService extends BaseServiceV2<
  MessageRelayerOptions,
  Record<string, never>,
  MessageRelayerState
> {
  constructor(options?: Partial<MessageRelayerOptions>) {
    super({
      name: "Message_Relayer",
      version: "1.0.0",
      options,
      optionsSpec,
      metricsSpec: { },
      loop: false,
    });
  }

  protected async init(): Promise<void> {
    this.state.wallet = this.options.l1Wallet.connect(
      this.options.l1RpcProvider
    );

    this.state.messenger = new CrossChainMessenger({
      l1SignerOrProvider: this.state.wallet,
      l2SignerOrProvider: this.options.l2RpcProvider,
      l1ChainId: await getChainId(this.state.wallet.provider),
      l2ChainId: await getChainId(this.options.l2RpcProvider),
    });

    const receipt = await this.state.messenger.l2Provider.getTransactionReceipt(this.options.fromL2TransactionHash);
    this.state.l2TxBlockNumber = receipt.blockNumber;
  }

  protected async main(): Promise<void> {
    const messages = await this.state.messenger.getMessagesByTransaction(
      this.options.fromL2TransactionHash
    );

    // No messages in this transaction, so there's nothing to do
    if (messages.length === 0) {
      throw new Error(`no message found in L2 transaction ${this.options.fromL2TransactionHash}`);
    }
    if (messages.length > 1) {
      throw new Error(`multiple messages found in L2 transaction ${this.options.fromL2TransactionHash}`);
    }

    const message = messages[0];
    const status = await this.state.messenger.getMessageStatus(message);

    if (status === MessageStatus.IN_CHALLENGE_PERIOD ||
      status === MessageStatus.STATE_ROOT_NOT_PUBLISHED) {
      throw new Error("tx not yet finalized");
    } else {
      this.logger.info(
        "tx is finalized, relaying..."
      );
    }

    // Now we can relay the message to L1.
    try {
      const tx = await this.state.messenger.finalizeMessage(message);
      this.logger.info(`relayer sent tx: ${tx.hash}`);
    } catch (err) {
      if (!err.message.includes("message has already been received")) {
        throw err;
      } // Otherwise the message was relayed by someone else
    }
    await this.state.messenger.waitForMessageReceipt(message);
  }
}

async function returnOnPpidChange(startPpid: number) {
  while (startPpid === ppid) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log(`Relayer parent pid changed, shutting down. Old ppid: ${startPpid}, new ppid: ${ppid}`);
  process.exit(1);
}

if (require.main === module) {
  const startPpid = ppid;
  const service = new MessageRelayerService();

  try {
    Promise.race([
      service.run(),
      returnOnPpidChange(startPpid),
    ]);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
