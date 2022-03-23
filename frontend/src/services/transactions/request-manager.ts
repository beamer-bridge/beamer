import { JsonRpcSigner, TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import { Contract } from 'ethers';
import { DeepReadonly, Ref } from 'vue';

import RequestManager from '@/assets/RequestManager.json';
import { EthereumProvider } from '@/services/web3-provider';
import { Request, RequestState } from '@/types/data';

function findFirstEvent(receipt: TransactionReceipt, eventName: string) {
  const isRequestCreated = (e) => {
    if ('undefined' === typeof e['event']) {
      return false;
    }
    console.log(e.event);
    return e.event === eventName;
  };
  return receipt.events.find(isRequestCreated);
}

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
    request.requestManagerAddress,
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
  //events is added dynamically when wait method called!
  // TODO verification of other args?
  const event = findFirstEvent(request.receipt, 'RequestCreated');
  if (!event) {
    //TODO error
  }
  request.requestId = event.args.requestId;
  return request;
}
