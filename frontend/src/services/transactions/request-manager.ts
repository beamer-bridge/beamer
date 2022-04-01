import { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';
import { Contract } from 'ethers';
import { DeepReadonly, Ref } from 'vue';

import RequestManager from '@/assets/RequestManager.json';
import { EthereumProvider } from '@/services/web3-provider';
import { Request, RequestState } from '@/types/data';

export async function getRequestFee(
  ethereumProvider: Readonly<EthereumProvider>,
  requestManagerAddress: string,
): Promise<number> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi);
  const connectedContract = ethereumProvider.connectContract(requestManagerContract);
  return await connectedContract.totalFee();
}

export async function sendRequestTransaction(
  signer: DeepReadonly<JsonRpcSigner>,
  request: Request,
  requestState: Ref<RequestState>,
): Promise<Request> {
  // TODO handle requestManagerAddress undefined
  if (!request.fee) {
    request.fee = await getRequestFee(signer, request);
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

  const transactionReceipt = await transaction.wait();
  request.receipt = transactionReceipt;

  return request;
}
