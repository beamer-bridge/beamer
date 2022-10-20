import type { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { BigNumberish } from 'ethers';
import { BigNumber, Contract } from 'ethers';

import RequestManager from '@/assets/RequestManager.json';
import { getContract } from '@/services/transactions/utils';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress } from '@/types/data';
import { UInt256 } from '@/types/uint-256';

export async function deriveBaseTransferableAmountFromTotalAmount(
  rpcUrl: string,
  requestManagerAddress: string,
  totalAmountWei: UInt256,
): Promise<UInt256> {
  const PARTS_IN_MILLION = new UInt256('1000000');
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  const minLpFeeWei: UInt256 = new UInt256(await contract.minLpFee());
  const lpFeePartsPerMillion: UInt256 = new UInt256(await contract.lpFeePPM());
  const protocolFeePartsPerMillion: UInt256 = new UInt256(await contract.protocolFeePPM());

  const lpFeePPMAmount = totalAmountWei.multiply(lpFeePartsPerMillion).divide(PARTS_IN_MILLION);

  if (lpFeePPMAmount.gte(minLpFeeWei)) {
    return totalAmountWei
      .multiply(PARTS_IN_MILLION)
      .divide(PARTS_IN_MILLION.add(protocolFeePartsPerMillion).add(lpFeePartsPerMillion));
  } else {
    try {
      return totalAmountWei
        .multiply(PARTS_IN_MILLION)
        .divide(PARTS_IN_MILLION.add(protocolFeePartsPerMillion))
        .subtract(minLpFeeWei);
    } catch (e) {
      throw new Error(
        'Cannot derive base amount. Total amount is not high enough to cover the fees.',
      );
    }
  }
}

export async function getMinRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
): Promise<UInt256> {
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  const minLpFee: BigNumberish = await contract.minLpFee();
  return new UInt256(minLpFee.toString());
}

export async function getRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
  transferAmount: UInt256,
): Promise<UInt256> {
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  const fetchedAmount: BigNumberish = await contract.totalFee(
    BigNumber.from(transferAmount.asString),
  );
  return new UInt256(fetchedAmount.toString());
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
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);

  const requestParameter = [
    targetChainIdentifier,
    sourceTokenAddress,
    targetTokenAddress,
    targetAccount,
    BigNumber.from(amount.asString),
    BigNumber.from(validityPeriod.asString),
  ];

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
): Promise<UInt256> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  const receipt = await provider.waitForTransaction(transactionHash, 1);
  if (receipt) {
    const event = contract.interface.parseLog(receipt.logs[0]);
    if (event) {
      return new UInt256(event.args.requestId);
    }
  }

  throw new Error("Request Failed. Couldn't retrieve Request ID");
}

type RequestData = {
  validUntil: BigNumber;
  activeClaims: BigNumber;
  withdrawInfo: { filler: EthereumAddress };
};

export async function getRequestData(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: UInt256,
): Promise<RequestData> {
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  const request: RequestData | undefined = await contract.requests(
    BigNumber.from(requestIdentifier.asString),
  );

  if (request !== undefined) {
    return request;
  } else {
    throw new Error('No request known for this identifier!');
  }
}
type RequestExpiryInfo = {
  validityExpired: boolean;
  noActiveClaims: boolean;
  notWithdrawnBySomeoneElse: boolean;
  timeToExpiredMillis: number;
};
export async function getRequestExpiryInfo(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: UInt256,
  requestAccount: string,
): Promise<RequestExpiryInfo> {
  const { validUntil, activeClaims, withdrawInfo } = await getRequestData(
    rpcUrl,
    requestManagerAddress,
    requestIdentifier,
  );
  const provider = new JsonRpcProvider(rpcUrl);
  const block = await provider.getBlock('latest');
  const validityExpired = validUntil.lt(block.timestamp);
  const noActiveClaims = activeClaims.eq(0);
  const notWithdrawnBySomeoneElse =
    withdrawInfo.filler.toLowerCase() == '0x0000000000000000000000000000000000000000' ||
    withdrawInfo.filler.toLowerCase() == requestAccount.toLowerCase();

  const timeNow = BigNumber.from(Date.now());
  const timeToExpiredMillis = Math.max(validUntil.mul(1000).sub(timeNow).toNumber(), 0);

  return {
    validityExpired,
    noActiveClaims,
    notWithdrawnBySomeoneElse,
    timeToExpiredMillis,
  };
}

export function failWhenRequestExpires(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: UInt256,
  requestAccount: string,
): Cancelable<void> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = getContract(rpcUrl, requestManagerAddress, RequestManager.abi);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<void>((_, reject) => {
    const cleanUpAndReject = () => {
      provider.removeAllListeners();
      contract.removeAllListeners();
      reject(new RequestExpiredError());
    };

    const attachClaimWithdrawnListener = async () => {
      const eventFilter = contract.filters.ClaimStakeWithdrawn(
        undefined,
        BigNumber.from(requestIdentifier.asString),
      );

      contract.on(eventFilter, async () => {
        const { activeClaims } = await getRequestData(
          rpcUrl,
          requestManagerAddress,
          requestIdentifier,
        );
        if (activeClaims.eq(0)) {
          cleanUpAndReject();
        }
      });
    };

    const configureListeners = async () => {
      const requestExpiryInfo = await getRequestExpiryInfo(
        rpcUrl,
        requestManagerAddress,
        requestIdentifier,
        requestAccount,
      );

      // If not expired by sequencer clock
      if (!requestExpiryInfo.validityExpired) {
        // And expired by our clock
        if (requestExpiryInfo.timeToExpiredMillis === 0) {
          // wait on new blocks until expired by sequencer clock
          provider.once('block', configureListeners);
        }
        // sleep until expired by our clock
        else {
          timeout = setTimeout(configureListeners, requestExpiryInfo.timeToExpiredMillis);
        }
      } else {
        if (!requestExpiryInfo.notWithdrawnBySomeoneElse) {
          return cleanUpAndReject();
        }
        if (!requestExpiryInfo.noActiveClaims) {
          return attachClaimWithdrawnListener();
        }

        return cleanUpAndReject();
      }
    };

    configureListeners();
  });

  const cancel = () => {
    provider.removeAllListeners();
    contract.removeAllListeners();
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return { promise, cancel };
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
  requestIdentifier: UInt256,
): Promise<void> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);

  const requestParameter = [BigNumber.from(requestIdentifier.asString)];

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

function getTransactionErrorMessage(error: unknown): string {
  const maybeErrorCode = (error as { code?: number }).code;

  // TODO move all custom errors to error handling library
  if (error instanceof Error) {
    return error.message;
  } else if (maybeErrorCode && maybeErrorCode === 4001) {
    return 'Transaction got rejected!';
  } else if (maybeErrorCode && maybeErrorCode === -32603) {
    return 'Insufficient balance!';
  } else {
    return 'Unknown failure!';
  }
}
