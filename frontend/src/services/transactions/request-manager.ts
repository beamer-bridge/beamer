import type { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';

import RequestManagerDeployment from '@/assets/RequestManager.json';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress, TokenAttributes } from '@/types/data';
import type { RequestManager } from '@/types/ethers-contracts';
import type { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

import {
  getJsonRpcProvider,
  getLatestBlock,
  getReadOnlyContract,
  getReadWriteContract,
} from './utils';

export async function getTokenAttributes(
  rpcUrl: string,
  requestManagerAddress: string,
  tokenAddress: string,
): Promise<TokenAttributes> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );

  const tokenDefinition = await contract.tokens(tokenAddress);

  return {
    transferLimit: new UInt256(tokenDefinition.transferLimit.toString()),
    minLpFee: new UInt256(tokenDefinition.minLpFee.toString()),
    lpFeePPM: new UInt256(tokenDefinition.lpFeePPM.toString()),
    protocolFeePPM: new UInt256(tokenDefinition.protocolFeePPM.toString()),
    collectedProtocolFees: new UInt256(tokenDefinition.collectedProtocolFees.toString()),
  };
}

export async function getAmountBeforeFees(
  totalAmount: TokenAmount,
  rpcUrl: string,
  requestManagerAddress: string,
): Promise<UInt256> {
  const { minLpFee, lpFeePPM, protocolFeePPM } = await getTokenAttributes(
    rpcUrl,
    requestManagerAddress,
    totalAmount.token.address,
  );

  const PARTS_IN_MILLION = new UInt256('1000000');
  const totalAmountWei = totalAmount.uint256;
  const lpFeePPMAmount = totalAmountWei.multiply(lpFeePPM).divide(PARTS_IN_MILLION);

  if (lpFeePPMAmount.gte(minLpFee)) {
    return totalAmountWei
      .multiply(PARTS_IN_MILLION)
      .divide(PARTS_IN_MILLION.add(protocolFeePPM).add(lpFeePPM));
  } else {
    try {
      return totalAmountWei
        .multiply(PARTS_IN_MILLION)
        .divide(PARTS_IN_MILLION.add(protocolFeePPM))
        .subtract(minLpFee);
    } catch (e) {
      throw new Error(
        'Cannot derive base amount. Total amount is not high enough to cover the fees.',
      );
    }
  }
}

export async function getRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
  transferAmount: TokenAmount,
): Promise<UInt256> {
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );
  return new UInt256(
    (
      await contract.totalFee(transferAmount.token.address, transferAmount.uint256.asBigNumber)
    ).toString(),
  );
}

export async function sendRequestTransaction(
  signer: JsonRpcSigner,
  amount: UInt256,
  targetChainIdentifier: number,
  requestManagerAddress: EthereumAddress,
  sourceTokenAddress: EthereumAddress,
  targetTokenAddress: EthereumAddress,
  targetAccount: EthereumAddress,
  validityPeriod: UInt256,
): Promise<string> {
  const requestManagerContract = getReadWriteContract<RequestManager>(
    requestManagerAddress,
    RequestManagerDeployment.abi,
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

    const transaction: TransactionResponse = await requestManagerContract.createRequest(
      ...requestParameter,
      { gasLimit: estimatedGasLimit },
    );

    return transaction.hash;
  } catch (error: unknown) {
    console.error(error);
    const parseErrorMessage = getTransactionErrorMessage(error);
    throw new Error(parseErrorMessage);
  }
}

export async function getRequestIdentifier(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  transactionHash: string,
): Promise<string> {
  const provider = getJsonRpcProvider(rpcUrl);
  const contract = getReadOnlyContract<RequestManager>(
    requestManagerAddress,
    RequestManagerDeployment.abi,
    provider,
  );
  const receipt = await provider.waitForTransaction(transactionHash, 1);
  if (receipt) {
    const event = contract.interface.parseLog(receipt.logs[0]);
    if (event) {
      return event.args.requestId;
    }
  }

  throw new Error("Request Failed. Couldn't retrieve Request ID");
}

export type RequestData = {
  validUntil: UInt256;
  activeClaims: UInt256;
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
    RequestManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );

  const request = await contract.requests(requestIdentifier);

  if (request !== undefined) {
    return {
      validUntil: new UInt256(request.validUntil.toString()),
      activeClaims: new UInt256(request.activeClaims.toString()),
      withdrawClaimId: new UInt256(request.withdrawClaimId.toString()),
      withdrawn: !request.withdrawClaimId.isZero(),
    };
  } else {
    throw new Error('No request known for this identifier!');
  }
}

export function getTimeToExpiredMilliseconds(validUntil: UInt256): number {
  const timestampNowMilliseconds = new UInt256(Date.now().toString());
  try {
    return validUntil.multiply(new UInt256('1000')).subtract(timestampNowMilliseconds).asNumber;
  } catch (e) {
    return 0;
  }
}

export function isRequestExpiredByLocalClock(validUntil: UInt256) {
  return getTimeToExpiredMilliseconds(validUntil) === 0;
}

export async function isRequestExpiredByLatestBlock(
  validUntil: UInt256,
  rpcUrl: string,
): Promise<boolean> {
  const block = await getLatestBlock(rpcUrl);
  const validityExpired = validUntil.lt(new UInt256(block.timestamp.toString()));

  return validityExpired;
}

export function isRequestClaimed(claimCount: UInt256): boolean {
  return !claimCount.isZero();
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
    RequestManagerDeployment.abi,
    provider,
  );
  const cancel = () => {
    contract.removeAllListeners();
  };

  const queryFilter = contract.filters.ClaimStakeWithdrawn(undefined, requestIdentifier);

  const promise = new Promise<void>((resolve) => {
    let claimCount = activeClaimCount;
    if (claimCount > 0) {
      contract.on(queryFilter, () => {
        if (--claimCount == 0) {
          resolve();
        }
      });
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
            requestData.activeClaims.asNumber,
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
  signer: JsonRpcSigner,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: string,
): Promise<void> {
  const requestManagerContract = getReadWriteContract<RequestManager>(
    requestManagerAddress,
    RequestManagerDeployment.abi,
    signer,
  );

  const requestParameter = [requestIdentifier] as const;

  try {
    const estimatedGasLimit = await requestManagerContract.estimateGas.withdrawExpiredRequest(
      ...requestParameter,
    );

    const transaction: TransactionResponse = await requestManagerContract.withdrawExpiredRequest(
      ...requestParameter,
      { gasLimit: estimatedGasLimit },
    );

    await transaction.wait();
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
