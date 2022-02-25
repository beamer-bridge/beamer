import { JsonRpcSigner, TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly, Ref, ref } from 'vue';

import RequestManager from '@/assets/RequestManager.json';
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
  signer: DeepReadonly<JsonRpcSigner>,
  requestManagerAddress: string,
): Promise<number> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);
  return await requestManagerContract.totalFee();
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
  const requestManagerContract = new Contract(
    request.requestManagerAddress,
    RequestManager.abi,
    signer,
  );
  const transaction: TransactionResponse = await requestManagerContract.createRequest(
    request.targetChainId,
    request.sourceTokenAddress,
    request.targetTokenAddress,
    request.targetAddress,
    request.amount,
    { value: request.fee },
  );

  requestState.value = RequestState.WaitTransaction;
  const transactionReceipt = await transaction.wait();
  request.receipt = transactionReceipt;

  //events is addded dynamically when wait method called!
  // TODO verification of other args?
  const event = findFirstEvent(request.receipt, 'RequestCreated');
  if (!event) {
    //TODO error
  }
  request.requestId = event.args.requestId;
  return request;
}
