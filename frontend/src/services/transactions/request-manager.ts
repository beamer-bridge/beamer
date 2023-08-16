import type { Listener, TransactionResponse } from '@ethersproject/providers';

import type { Cancelable } from '@/types/async';
import type { EthereumAddress, TransactionHash } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import { RequestManager__factory } from '#contract-factories/RequestManager__factory.ts';
import type { RequestManager } from '#contracts/RequestManager.ts';

import type { IEthereumWallet } from '../web3-provider';
import {
  getConfirmationTimeBlocksForChain,
  getJsonRpcProvider,
  getLatestBlock,
  getReadOnlyContract,
  getReadWriteContract,
  getSafeEventHandler,
} from './utils';

export async function getTokenMinLpFee(
  rpcUrl: string,
  requestManagerAddress: string,
  targetChainId: number,
  tokenAddress: string,
): Promise<UInt256> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );

  const minLpFee = await contract.minLpFee(targetChainId, tokenAddress);

  return new UInt256(minLpFee.toString());
}

export async function getTokenTransferLimit(
  rpcUrl: string,
  requestManagerAddress: string,
  tokenAddress: string,
): Promise<UInt256> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );

  const tokenDefinition = await contract.tokens(tokenAddress);

  return new UInt256(tokenDefinition.transferLimit.toString());
}

export async function getAmountBeforeFees(
  totalAmount: TokenAmount,
  rpcUrl: string,
  requestManagerAddress: string,
  targetChainId: number,
): Promise<UInt256> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const tokenAddress = totalAmount.token.address;

  try {
    const transferableAmount = await contract.transferableAmount(
      targetChainId,
      tokenAddress,
      totalAmount.uint256.asBigNumber,
    );
    return new UInt256(transferableAmount.toString());
  } catch (e) {
    throw new Error(
      'Cannot derive base amount. Total amount is not high enough to cover the fees.',
    );
  }
}

export async function getRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
  transferAmount: TokenAmount,
  targetChainId: number,
): Promise<UInt256> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );
  return new UInt256(
    (
      await contract.totalFee(
        targetChainId,
        transferAmount.token.address,
        transferAmount.uint256.asBigNumber,
      )
    ).toString(),
  );
}

export async function sendRequestTransaction(
  provider: IEthereumWallet,
  amount: UInt256,
  targetChainIdentifier: number,
  requestManagerAddress: EthereumAddress,
  sourceTokenAddress: EthereumAddress,
  targetTokenAddress: EthereumAddress,
  targetAccount: EthereumAddress,
  validityPeriod: UInt256,
): Promise<TransactionHash> {
  const signer = provider.signer.value;
  if (signer === undefined) {
    throw new Error('Missing signer!');
  }
  const requestManagerContract = getReadWriteContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    signer,
  );
  const requestParameter = [
    targetChainIdentifier,
    sourceTokenAddress,
    targetTokenAddress,
    targetAccount,
    amount.asBigNumber,
    validityPeriod.asBigNumber,
  ] as const;

  try {
    const estimatedGasLimit = await requestManagerContract.estimateGas.createRequest(
      ...requestParameter,
    );

    const transaction = await requestManagerContract.createRequest(...requestParameter, {
      gasLimit: estimatedGasLimit,
    });

    return transaction.hash;
  } catch (error: unknown) {
    console.error(error);
    const parseErrorMessage = getTransactionErrorMessage(error);
    throw new Error(parseErrorMessage);
  }
}

export async function getRequestInformation(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  transactionHash: string,
): Promise<string> {
  const provider = getJsonRpcProvider(rpcUrl);
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    provider,
  );
  const { chainId } = await provider.getNetwork();

  const receipt = await provider.waitForTransaction(
    transactionHash,
    getConfirmationTimeBlocksForChain(chainId),
  );

  if (!receipt) {
    throw new Error('Transaction not found.');
  }
  if (receipt.status !== 1) {
    throw new Error('Transaction reverted on chain.');
  }
  for (const log of receipt.logs) {
    let event;
    try {
      event = contract.interface.parseLog(log);
    } catch (e) {
      continue;
    }
    if (event && event.args.requestId) {
      return event.args.requestId;
    }
  }
  throw new Error("Request Failed. Couldn't retrieve Request ID.");
}

export type RequestData = {
  validUntil: number;
  activeClaims: number;
  withdrawClaimId: UInt256;
};

type RequestDataDerivedProperties = {
  withdrawn: boolean;
};

export async function getRequestData(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: string,
): Promise<RequestData & RequestDataDerivedProperties> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );

  const request = await contract.requests(requestIdentifier);

  if (request !== undefined) {
    return {
      validUntil: request.validUntil,
      activeClaims: request.activeClaims,
      withdrawClaimId: new UInt256(request.withdrawClaimId.toString()),
      withdrawn: !request.withdrawClaimId.isZero(),
    };
  } else {
    throw new Error('No request known for this identifier!');
  }
}

export function getTimeToExpiredMilliseconds(validUntil: number): number {
  const timestampNowMilliseconds = Date.now();
  const validUntilMilliseconds = validUntil * 1000;
  return Math.max(0, validUntilMilliseconds - timestampNowMilliseconds);
}

export const isRequestExpiredByLocalClock = (validUntil: number): boolean =>
  getTimeToExpiredMilliseconds(validUntil) === 0;

export async function isRequestExpiredByLatestBlock(
  validUntil: number,
  rpcUrl: string,
): Promise<boolean> {
  const block = await getLatestBlock(rpcUrl);
  return validUntil < block.timestamp;
}

export const isRequestClaimed = (claimCount: number): boolean => claimCount !== 0;

export function listenOnClaimCountChange(options: {
  rpcUrl: string;
  requestManagerAddress: EthereumAddress;
  requestIdentifier: string;
  onReduce: Listener;
  onIncrease: Listener;
}): { cancel: CallableFunction } {
  const provider = getJsonRpcProvider(options.rpcUrl);
  const contract = getReadOnlyContract<RequestManager>(
    options.requestManagerAddress,
    RequestManager__factory.abi,
    provider,
  );

  const reduceFilter = contract.filters.ClaimStakeWithdrawn(undefined, options.requestIdentifier);
  const increaseFilter = contract.filters.ClaimMade(options.requestIdentifier);

  contract.on(reduceFilter, getSafeEventHandler(options.onReduce, provider));
  contract.on(increaseFilter, getSafeEventHandler(options.onIncrease, provider));

  const cancel = () => {
    contract.removeAllListeners();
  };

  return { cancel };
}

export function waitUntilClaimsWithdrawn(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: string,
  activeClaimCount: number,
): Cancelable<void> {
  const provider = getJsonRpcProvider(rpcUrl);
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    provider,
  );
  const cancel = () => {
    contract.removeAllListeners();
  };

  const queryFilter = contract.filters.ClaimStakeWithdrawn(undefined, requestIdentifier);

  const promise = new Promise<void>((resolve) => {
    let claimCount = activeClaimCount;
    const reduceClaimCountOrResolve = () => {
      if (--claimCount == 0) {
        resolve();
      }
    };

    if (claimCount > 0) {
      contract.on(queryFilter, getSafeEventHandler(reduceClaimCountOrResolve, provider));
    } else {
      resolve();
    }
  });

  return { cancel, promise };
}

export function failWhenRequestExpires(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: string,
): Cancelable<void> {
  const provider = getJsonRpcProvider(rpcUrl);
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let cancelWaitUntilClaimsWithdrawn: (() => void) | null = null;

  const cleanUp = () => {
    provider.removeAllListeners();
    if (cancelWaitUntilClaimsWithdrawn !== null) {
      cancelWaitUntilClaimsWithdrawn();
    }
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const promise = new Promise<void>((_, reject) => {
    const cleanUpAndReject = () => {
      cleanUp();
      reject(new RequestExpiredError());
    };

    const configureListeners = async () => {
      const requestData = await getRequestData(rpcUrl, requestManagerAddress, requestIdentifier);
      const validityExpiredByLatestBlock = await isRequestExpiredByLatestBlock(
        requestData.validUntil,
        rpcUrl,
      );
      const validityExpiredByLocalClock = await isRequestExpiredByLocalClock(
        requestData.validUntil,
      );

      if (validityExpiredByLatestBlock) {
        if (isRequestClaimed(requestData.activeClaims)) {
          const { promise, cancel } = waitUntilClaimsWithdrawn(
            rpcUrl,
            requestManagerAddress,
            requestIdentifier,
            requestData.activeClaims,
          );

          cancelWaitUntilClaimsWithdrawn = cancel;
          promise.then(() => configureListeners());
        } else {
          return cleanUpAndReject();
        }
      } else if (validityExpiredByLocalClock) {
        provider.once('block', configureListeners);
      } else {
        const timeToExpiredMillis = getTimeToExpiredMilliseconds(requestData.validUntil);
        timeout = setTimeout(configureListeners, timeToExpiredMillis);
      }
    };

    configureListeners();
  });

  return { promise, cancel: cleanUp };
}

export class RequestExpiredError extends Error {
  constructor() {
    super('Request has expired!');
    Object.setPrototypeOf(this, RequestExpiredError.prototype);
  }
}

export async function withdrawRequest(
  provider: IEthereumWallet,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: string,
): Promise<void> {
  const signer = provider.signer.value;
  if (signer === undefined) {
    throw new Error('Missing signer!');
  }
  const requestManagerContract = getReadWriteContract<RequestManager>(
    requestManagerAddress,
    RequestManager__factory.abi,
    signer,
  );
  const chainId = await signer.getChainId();

  const requestParameter = [requestIdentifier] as const;

  try {
    const estimatedGasLimit = await requestManagerContract.estimateGas.withdrawExpiredRequest(
      ...requestParameter,
    );

    const transaction: TransactionResponse = await requestManagerContract.withdrawExpiredRequest(
      ...requestParameter,
      { gasLimit: estimatedGasLimit },
    );

    await transaction.wait(getConfirmationTimeBlocksForChain(chainId));
  } catch (error: unknown) {
    console.error(error);
    const parseErrorMessage = getTransactionErrorMessage(error);
    throw new Error(parseErrorMessage);
  }
}

type TransactionError = { code?: number; data?: { data?: { reason: string } } };

function getTransactionErrorMessage(error: unknown): string {
  const maybeError = error as TransactionError;

  // TODO move all custom errors to error handling library
  if (error instanceof Error) {
    return error.message;
  } else if (maybeError.code && maybeError.code === 4001) {
    return 'Transaction got rejected!';
  } else if (maybeError.code && maybeError.code === -32603) {
    return maybeError.data?.data?.reason || 'Internal JSON-RPC error';
  } else {
    return 'Unknown failure!';
  }
}
