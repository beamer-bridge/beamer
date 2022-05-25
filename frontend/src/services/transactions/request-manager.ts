import type { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { BigNumberish } from 'ethers';
import { BigNumber, Contract } from 'ethers';

import RequestManager from '@/assets/RequestManager.json';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress } from '@/types/data';
import { UInt256 } from '@/types/uint-256';

function getContract(rpcUrl: string, address: EthereumAddress): Contract {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Contract(address, RequestManager.abi, provider);
}

export async function getRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
  transferAmount: UInt256,
): Promise<UInt256> {
  const contract = getContract(rpcUrl, requestManagerAddress);
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
  const contract = getContract(rpcUrl, requestManagerAddress);
  const transaction = await provider.getTransaction(transactionHash);
  const receipt = await transaction.wait();
  const event = contract.interface.parseLog(receipt.logs[0]);

  if (event) {
    return new UInt256(event.args.requestId);
  } else {
    throw new Error("Request Failed. Couldn't retrieve Request ID");
  }
}

type RequestData = {
  validUntil: BigNumber;
  activeClaims: BigNumber;
  depositReceiver: string;
};

export async function getRequestData(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: UInt256,
): Promise<RequestData> {
  const contract = getContract(rpcUrl, requestManagerAddress);
  const request: RequestData | undefined = await contract.requests(
    BigNumber.from(requestIdentifier.asString),
  );

  if (request !== undefined) {
    return request;
  } else {
    throw new Error('No request known for this identifier!');
  }
}

export async function checkIfRequestHasExpired(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: UInt256,
  requestAccount: string,
): Promise<boolean> {
  const request = await getRequestData(rpcUrl, requestManagerAddress, requestIdentifier);
  const provider = new JsonRpcProvider(rpcUrl);
  const block = await provider.getBlock('latest');
  const validityExpired = request.validUntil.lt(block.timestamp);
  const noActiveClaims = request.activeClaims.eq(0);
  const notWithdrawnBySomeoneElse =
    request.depositReceiver.toLowerCase() == '0x0000000000000000000000000000000000000000' ||
    request.depositReceiver.toLowerCase() == requestAccount.toLowerCase();

  return validityExpired && noActiveClaims && notWithdrawnBySomeoneElse;
}

export function failWhenRequestExpires(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: UInt256,
  requestAccount: string,
): Cancelable<void> {
  const provider = new JsonRpcProvider(rpcUrl);

  const promise = new Promise<void>((_, reject) => {
    const checkExpiration = async () => {
      const hasExpired = await checkIfRequestHasExpired(
        rpcUrl,
        requestManagerAddress,
        requestIdentifier,
        requestAccount,
      );

      if (hasExpired) {
        provider.removeAllListeners();
        reject(new RequestExpiredError());
      }
    };

    checkExpiration();
    provider.on('block', checkExpiration);
  });

  const cancel = () => provider.removeAllListeners();
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
