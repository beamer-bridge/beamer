import type {
  JsonRpcProvider,
  JsonRpcSigner,
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly, Ref } from 'vue';

import RequestManager from '@/assets/RequestManager.json';
import type { EthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress, Request } from '@/types/data';
import { RequestState } from '@/types/data';

export async function getRequestFee(
  provider: EthereumProvider,
  requestManagerAddress: string,
): Promise<number> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi);
  const connectedContract = provider.connectContract(requestManagerContract);
  return await connectedContract.totalFee();
}

interface TransactionReceiptInterface extends TransactionReceipt {
  events: Array<{ event: string; args: { requestId: BigNumber } }>;
}

function getEvent(receipt: TransactionReceiptInterface, eventName: string) {
  return receipt.events.find((event) => event.event === eventName);
}
export async function sendRequestTransaction(
  provider: EthereumProvider,
  signer: DeepReadonly<JsonRpcSigner>,
  request: Request,
  requestState: Ref<RequestState>,
): Promise<Request> {
  if (!request.fee) {
    request.fee = await getRequestFee(provider, request);
  }
  if (!request.validityPeriod) {
    request.validityPeriod = 600;
  }

  const requestManagerContract = new Contract(
    request.requestManagerAddress as string,
    RequestManager.abi,
    signer,
  );

  const requestParams = [
    request.targetChainId,
    request.sourceTokenAddress,
    request.targetTokenAddress,
    request.targetAddress,
    request.amount,
    request.validityPeriod,
  ];

  const estimatedGasLimit = await requestManagerContract.estimateGas.createRequest(
    ...requestParams,
    { value: request.fee },
  );

  const transaction: TransactionResponse = await requestManagerContract.createRequest(
    ...requestParams,
    { value: request.fee, gasLimit: estimatedGasLimit },
  );

  requestState.value = RequestState.WaitTransaction;

  const transactionReceipt = (await transaction.wait()) as TransactionReceiptInterface;
  const requestEvent = getEvent(transactionReceipt, 'RequestCreated');

  if (!requestEvent) {
    throw new Error("Request Failed. Couldn't retrieve Request ID");
  }

  request.requestId = requestEvent.args.requestId;

  return request;
}

export async function makeRequestTransaction(
  signer: JsonRpcSigner,
  amount: number,
  targetChainIdentifier: number,
  requestManagerAddress: EthereumAddress,
  sourceTokenAddress: EthereumAddress,
  targetTokenAddress: EthereumAddress,
  targetAccount: EthereumAddress,
  validityPeriod: number,
  fees: number, // TODO: BigNumber ?
): Promise<string> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);

  const requestParameter = [
    targetChainIdentifier,
    sourceTokenAddress,
    targetTokenAddress,
    targetAccount,
    amount, // TODO: BigNumber ?
    validityPeriod, // TODO: BigNumber ?
  ];

  const estimatedGasLimit = await requestManagerContract.estimateGas.createRequest(
    ...requestParameter,
    { value: fees },
  );

  try {
    const transaction: TransactionResponse = await requestManagerContract.createRequest(
      ...requestParameter,
      { value: fees, gasLimit: estimatedGasLimit },
    );

    return transaction.hash;
  } catch (error: unknown) {
    const parseErrorMessage = getTransactionErrorMessage(error);
    throw new Error(parseErrorMessage);
  }
}

export async function getRequestIdentifier(
  provider: JsonRpcProvider,
  requestManagerAddress: EthereumAddress,
  transactionHash: string,
): Promise<number> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, provider);
  const transaction = await provider.getTransaction(transactionHash);
  const receipt = await transaction.wait();
  const event = requestManagerContract.interface.parseLog(receipt.logs[0]);

  if (event) {
    return event.args.requestId.toNumber(); // TODO: check this typing
  } else {
    throw new Error("Request Failed. Couldn't retrieve Request ID");
  }
}

function getTransactionErrorMessage(error: unknown): string {
  const maybeErrorCode = (error as { code?: number }).code;

  // TODO move all custom errors to error handling library
  if (error instanceof Error) {
    return error.message;
  } else if (maybeErrorCode && maybeErrorCode === 4001) {
    return 'Error: User rejected the transaction!';
  } else if (maybeErrorCode && maybeErrorCode === -32603) {
    return 'Error: Insufficient balance!';
  } else {
    return 'Unknown failure!';
  }
}
