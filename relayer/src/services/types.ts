import type { Provider } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Wallet } from "ethers";
import fs from "fs";
import type { FillInvalidatedEvent } from "types-gen/contracts/FillManager";
import type { RequestResolvedEvent } from "types-gen/contracts/RequestManager";

import { RequestManager__factory, Resolver__factory } from "../../types-gen/contracts";
import type { TypedEvent, TypedEventFilter } from "../../types-gen/contracts/common";
import { parseFillInvalidatedEvent } from "../common/events/FillInvalidated";
import { parseRequestFilledEvent } from "../common/events/RequestFilled";
import { fetchFirstMatchingEvent } from "../common/events/utils";
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

// TODO: import from `deployments` npm package once ready
const L1_CONTRACTS: Record<number, { RESOLVER: string; RESOLVER_DEPLOY_BLOCK_NUMBER: number }> = {
  1: {
    RESOLVER: "0xD64c58A150545cb2B1985aFa7D3774617E40292E",
    RESOLVER_DEPLOY_BLOCK_NUMBER: 17913929,
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

// TODO: import from `deployments` npm package once ready
const L2_CONTRACTS: Record<number, { REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: number }> = {
  1: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 17913937,
  },
  10: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 108213849,
  },
  1101: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 4463667,
  },
  42161: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 121351107,
  },
  8453: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 2618918,
  },
  5: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 9066317,
  },
  420: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 9831210,
  },
  1442: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 779677,
  },
  84531: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 4948492,
  },
  421613: {
    REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER: 22127580,
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
    keystoreFile: string,
    password: string,
    l1ChainId: number,
    l2ChainId: number,
    destinationChainId?: number,
    customNetworkFilePath?: string,
  ) {
    this.l1RpcUrl = l1RpcURL;
    this.l2RpcUrl = l2RpcURL;
    const encryptedWalletJson = fs.readFileSync(keystoreFile, { encoding: "utf-8" });
    const wallet = Wallet.fromEncryptedJsonSync(encryptedWalletJson, password);
    this.l1Wallet = wallet.connect(new ExtendedJsonRpcProvider(l1RpcURL));
    this.l2Wallet = wallet.connect(new JsonRpcProvider(l2RpcURL));
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

  async checkSuccessOnRequestManager(
    resolvedRequestId: string,
    resolvedFillId: string,
    timeoutMs = 300000,
  ): Promise<boolean> {
    const resolverAddress = L1_CONTRACTS[this.l1ChainId]?.RESOLVER ?? process.env.RESOLVER;
    const resolver = Resolver__factory.connect(resolverAddress, this.l1RpcProvider);
    const requestManagerAddress = (await resolver.sourceChainInfos(this.l2ChainId)).requestManager;
    const requestManager = RequestManager__factory.connect(
      requestManagerAddress,
      this.l2RpcProvider,
    );

    const clearListenersAndResolveWithValue = (
      resolve: (value: boolean) => void,
      value: boolean,
    ) => {
      requestManager.removeAllListeners();
      resolve(value);
    };

    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => clearListenersAndResolveWithValue(resolve, false), timeoutMs),
    );

    const resolved = new Promise<boolean>((resolve) => {
      const succeed = () => {
        clearListenersAndResolveWithValue(resolve, true);
      };

      const fillInvalidatedFilter = requestManager.filters.FillInvalidatedResolved();
      const requestResolvedFilter = requestManager.filters.RequestResolved();

      requestManager.on(fillInvalidatedFilter, (requestId, fillId) => {
        if (requestId === resolvedRequestId && fillId === resolvedFillId) {
          succeed();
        }
      });
      requestManager.on(requestResolvedFilter, (requestId, _filler, fillId) => {
        if (requestId === resolvedRequestId && fillId === resolvedFillId) {
          succeed();
        }
      });

      const requestManagerDeployBlockNumber =
        L2_CONTRACTS[this.l2ChainId]?.REQUEST_MANAGER_DEPLOY_BLOCK_NUMBER ?? 0;
      const argumentChecks = { requestId: resolvedRequestId, fillId: resolvedFillId };
      const latestBlock = this.l2Wallet.provider.getBlock("latest");

      latestBlock
        .then((currentBlock) => {
          return fetchFirstMatchingEvent<FillInvalidatedEvent>(
            requestManager,
            fillInvalidatedFilter,
            requestManagerDeployBlockNumber,
            currentBlock.number,
            argumentChecks,
          );
        })
        .then((event) => {
          if (event) {
            succeed();
          }
        });

      latestBlock
        .then((currentBlock) => {
          return fetchFirstMatchingEvent<RequestResolvedEvent>(
            requestManager,
            requestResolvedFilter,
            requestManagerDeployBlockNumber,
            currentBlock.number,
            argumentChecks,
          );
        })
        .then((event) => {
          if (event) {
            succeed();
          }
        });
    });

    return await Promise.race([resolved, timeout]);
  }

  public async parseFillEventDataFromTxHash(
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
    public isCompleted: (arg: T) => Promise<boolean>,
  ) {}
}

export class PrepareStep extends Step<void, void> {}
export class RelayStep extends Step<TransactionHash, TransactionHash> {
  constructor(
    execute: (arg: TransactionHash) => Promise<TransactionHash>,
    isCompleted: (arg: TransactionHash) => Promise<boolean>,
    public recoverL1TransactionHash: (arg: TransactionHash) => Promise<TransactionHash>,
  ) {
    super(execute, isCompleted);
  }
}
export class FinalizeStep extends Step<TransactionHash, void> {}
