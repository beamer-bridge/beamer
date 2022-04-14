import { Signer } from "ethers";
import { BaseServiceV2, validators } from "@eth-optimism/common-ts";
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";
import { Provider } from "@ethersproject/abstract-provider";

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

    const l1Network = await this.state.wallet.provider.getNetwork();
    const l1ChainId = l1Network.chainId;
    this.state.messenger = new CrossChainMessenger({
      l1SignerOrProvider: this.state.wallet,
      l2SignerOrProvider: this.options.l2RpcProvider,
      l1ChainId,
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
      this.logger.warn(`no message found in L2 transaction ${this.options.fromL2TransactionHash}`);
      return;
    }
    if (messages.length > 1) {
      this.logger.warn(`multiple messages found in L2 transaction ${this.options.fromL2TransactionHash}`);
      return;
    }

    const message = messages[0];
    const status = await this.state.messenger.getMessageStatus(message);

    if (status === MessageStatus.IN_CHALLENGE_PERIOD ||
      status === MessageStatus.STATE_ROOT_NOT_PUBLISHED) {
      this.logger.info(
        "tx not yet finalized"
      );
      return;
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

if (require.main === module) {
  const service = new MessageRelayerService();
  service.run();
}
