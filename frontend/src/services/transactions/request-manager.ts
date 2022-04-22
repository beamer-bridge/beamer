import { JsonRpcSigner, TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly, Ref } from 'vue';

import RequestManager from '@/assets/RequestManager.json';
import type { EthereumProvider } from '@/services/web3-provider';
import { Request, RequestState } from '@/types/data';

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
