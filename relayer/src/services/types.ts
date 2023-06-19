import type { Provider } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Wallet } from "ethers";

import { Resolver__factory } from "../../types-gen/contracts";
import type { TypedEvent, TypedEventFilter } from "../../types-gen/contracts/common";
import { parseFillInvalidatedEvent } from "../common/events/FillInvalidated";
import { parseRequestFilledEvent } from "../common/events/RequestFilled";
import { ExtendedJsonRpcProvider } from "../ethers/json-rpc-provider";
import type { ArbitrumRelayerService } from "./relayer/arbitrum";
import type { BobaRelayerService } from "./relayer/boba";
import type { EthereumRelayerService } from "./relayer/ethereum";
import type { OptimismRelayerService } from "./relayer/optimism";
import type { PolygonZKEvmRelayerService } from "./relayer/polygon-zkevm";

export type TransactionHash = string;

export type ExtendedRelayerService =
  | typeof ArbitrumRelayerService
  | typeof BobaRelayerService
  | typeof OptimismRelayerService
  | typeof EthereumRelayerService
  | typeof PolygonZKEvmRelayerService;

export type RelayCallParams = {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  filler: string;
};

const L1_CONTRACTS: Record<number, { RESOLVER: string; RESOLVER_DEPLOY_BLOCK_NUMBER: number }> = {
  1: {
    RESOLVER: "0xCb60516819a28431233195A8b7E0227C288B61AD",
    // TODO: import from `deployments` npm package once ready
    RESOLVER_DEPLOY_BLOCK_NUMBER: 16946576,
  },
  5: {
    RESOLVER: "0xDCBF185279C7D0F2d448cb674d9429323c8120DC",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 9066315,
  },
  1337: {
    RESOLVER: process.env.RESOLVER || "",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 0,
  },
};

const FILTER_BLOCKS_PER_ITERATION = 5000;

export abstract class BaseRelayerService {
  readonly l1RpcUrl: string;
  readonly l2RpcUrl: string;
  readonly l1Wallet: Wallet;
  readonly l2Wallet: Wallet;
  readonly l1ChainId: number;
  readonly l2ChainId: number;
  readonly destinationChainId?: number;

  abstract readonly prepareStep?: PrepareStep;
  abstract readonly relayTxToL1Step: RelayStep;
  abstract readonly finalizeStep?: FinalizeStep;

  constructor(
    l1RpcURL: string,
    l2RpcURL: string,
    privateKey: string,
    l1ChainId: number,
    l2ChainId: number,
    destinationChainId?: number,
    customNetworkFilePath?: string,
  ) {
    this.l1RpcUrl = l1RpcURL;
    this.l2RpcUrl = l2RpcURL;
    this.l1Wallet = new Wallet(privateKey, new ExtendedJsonRpcProvider(l1RpcURL));
    this.l2Wallet = new Wallet(privateKey, new JsonRpcProvider(l2RpcURL));
    this.l1ChainId = l1ChainId;
    this.l2ChainId = l2ChainId;
    this.destinationChainId = destinationChainId ?? undefined;
    if (customNetworkFilePath) {
      this.addCustomNetwork(customNetworkFilePath);
    }
  }

  get l2RpcProvider(): Provider {
    return this.l2Wallet.provider;
  }

  get l1RpcProvider(): Provider {
    return this.l1Wallet.provider;
  }

  async getL1ChainId() {
    return (await this.l1RpcProvider.getNetwork()).chainId;
  }

  async getL2ChainId() {
    return (await this.l2RpcProvider.getNetwork()).chainId;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addCustomNetwork(_filePath: string): void {
    return;
  }

  protected async parseFillEventDataFromTxHash(
    l2TransactionHash: TransactionHash,
  ): Promise<RelayCallParams> {
    const receipt = await this.l2RpcProvider.getTransactionReceipt(l2TransactionHash);

    if (!receipt) {
      throw new Error(`Transaction "${l2TransactionHash}" cannot be found on Ethereum...`);
    }

    const requestFilledEvent = parseRequestFilledEvent(receipt.logs);

    if (requestFilledEvent) {
      return {
        requestId: requestFilledEvent.requestId,
        fillId: requestFilledEvent.fillId,
        sourceChainId: requestFilledEvent.sourceChainId,
        filler: requestFilledEvent.filler,
      };
    }

    const fillInvalidatedEvent = parseFillInvalidatedEvent(receipt.logs);

    if (fillInvalidatedEvent && this.destinationChainId) {
      return {
        ...fillInvalidatedEvent,
        sourceChainId: BigNumber.from(this.destinationChainId),
        filler: "0x0000000000000000000000000000000000000000",
      };
    }

    throw new Error(
      "Couldn't find a matching event (RequestFilled | FillInvalidated) in the transaction logs.",
    );
  }

  protected async findL1TransactionHashForMessage(
    requestId: string,
    fillId: string,
    sourceChainId: BigNumber,
    filler: string,
    fillChainId: BigNumber,
  ): Promise<string | undefined> {
    const resolverAddress = L1_CONTRACTS[this.l1ChainId].RESOLVER;
    const resolver = Resolver__factory.connect(resolverAddress, this.l1Wallet);
    const currentBlock = await this.l1Wallet.provider.getBlock("latest");
    const resolverDeployBlockNumber = L1_CONTRACTS[this.l1ChainId].RESOLVER_DEPLOY_BLOCK_NUMBER;
    let currentBlockNumber = currentBlock.number;

    while (currentBlockNumber > resolverDeployBlockNumber) {
      const events = await resolver.queryFilter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "Resolution" as TypedEventFilter<TypedEvent<any, any>>,
        currentBlockNumber - FILTER_BLOCKS_PER_ITERATION,
        currentBlockNumber,
      );

      for (const event of events) {
        if (event.event === "Resolution") {
          const args = event.args;

          if (
            sourceChainId.eq(args.sourceChainId) &&
            fillChainId.eq(args.fillChainId) &&
            args.requestId === requestId &&
            args.filler === filler &&
            args.fillId === fillId
          ) {
            return event.transactionHash;
          }
        }
      }
      currentBlockNumber -= FILTER_BLOCKS_PER_ITERATION;
    }

    return undefined;
  }
}

abstract class Step<T, U> {
  constructor(
    public execute: (arg: T) => Promise<U>,
    public isCompleted: (arg: T) => Promise<U | false>,
  ) {}
}

export class PrepareStep extends Step<void, void> {}
export class RelayStep extends Step<TransactionHash, TransactionHash> {}
export class FinalizeStep extends Step<TransactionHash, void> {}
