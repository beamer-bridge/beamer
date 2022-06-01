import type { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { BigNumberish } from 'ethers';
import { BigNumber, Contract } from 'ethers';

import RequestManager from '@/assets/RequestManager.json';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress } from '@/types/data';
import { EthereumAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function getRequestFee(
  rpcUrl: string,
  requestManagerAddress: string,
): Promise<EthereumAmount> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = new Contract(requestManagerAddress, RequestManager.abi, provider);
  const fetchedAmount: BigNumberish = await contract.totalFee();
  return new EthereumAmount(fetchedAmount.toString());
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
  fees: UInt256,
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
      { value: BigNumber.from(fees.asString) },
    );

    const transaction: TransactionResponse = await requestManagerContract.createRequest(
      ...requestParameter,
      { value: BigNumber.from(fees.asString), gasLimit: estimatedGasLimit },
    );

    return transaction.hash;
  } catch (error: unknown) {
    const parseErrorMessage = getTransactionErrorMessage(error);
    console.log(parseErrorMessage);
    throw new Error(parseErrorMessage);
  }
}

export async function getRequestIdentifier(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  transactionHash: string,
): Promise<UInt256> {
  const provider = new JsonRpcProvider(rpcUrl);
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, provider);
  const transaction = await provider.getTransaction(transactionHash);
  const receipt = await transaction.wait();
  const event = requestManagerContract.interface.parseLog(receipt.logs[0]);

  if (event) {
    return new UInt256(event.args.requestId);
  } else {
    throw new Error("Request Failed. Couldn't retrieve Request ID");
  }
}

export async function checkIfRequestHasExpired(
  rpcUrl: string,
  requestManagerAddress: string,
  requestIdentifier: UInt256,
): Promise<boolean> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = new Contract(requestManagerAddress, RequestManager.abi, provider);
  const request: { validUntil: BigNumber; activeClaims: BigNumber } | undefined =
    await contract.requests(BigNumber.from(requestIdentifier.asString));

  if (request === undefined) {
    throw new Error('No request known for this identifier!');
  }

  const block = await provider.getBlock('latest');
  const validityExpired = request.validUntil.lt(block.timestamp);
  const noActiveClaims = request.activeClaims.eq(0);

  return validityExpired && noActiveClaims;
}

export function waitUntilRequestExpiresAndFail(
  rpcUrl: string,
  requestManagerAddress: EthereumAddress,
  requestIdentifier: UInt256,
): Cancelable<void> {
  const provider = new JsonRpcProvider(rpcUrl);

  const promise = new Promise<void>((_, reject) => {
    const checkExpiration = async () => {
      const hasExpired = await checkIfRequestHasExpired(
        rpcUrl,
        requestManagerAddress,
        requestIdentifier,
      );

      if (hasExpired) {
        provider.removeAllListeners();
        reject(new Error('Request has expired!'));
      }
    };

    checkExpiration();
    provider.on('block', checkExpiration);
  });

  const cancel = () => provider.removeAllListeners();
  return { promise, cancel };
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
