import { Option } from "commander";

import type { Options, TransactionHash } from "./types";
import { BaseRelayerService } from "./types";

type EthereumOptions = {
  requestId: string;
  fillId: string;
  chainId: string;
  sourceChainId: string;
};

function isValidEthereumOptions(options: Options): options is EthereumOptions {
  const ethereumOptions = options as EthereumOptions;
  return (
    !!ethereumOptions.requestId &&
    !!ethereumOptions.fillId &&
    !!ethereumOptions.chainId &&
    !!ethereumOptions.sourceChainId
  );
}

export class EthereumRelayerService extends BaseRelayerService {
  static readonly CLI_OPTIONS = [
    new Option("--request-id <hash>", "The request ID").makeOptionMandatory(),
    new Option("--fill-id <hash>", "The fill ID").makeOptionMandatory(),
    new Option("--chain-id <number>", "The chain ID of the target network").makeOptionMandatory(),
    new Option(
      "--source-chain-id <number>",
      "The chain ID of the source network",
    ).makeOptionMandatory(),
  ];

  options: EthereumOptions;

  configure(options: Options): void {
    if (!isValidEthereumOptions(options)) {
      console.error("Missing arguments for Ethereum relayer service.");
      process.exit(1);
    }

    this.options = options;
  }

  async prepareRelay(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(): Promise<TransactionHash | undefined> {
    return;
  }

  async finalizeRelay(): Promise<void> {
    return;
  }
}
