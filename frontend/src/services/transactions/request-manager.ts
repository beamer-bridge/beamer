import { JsonRpcSigner, TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly } from 'vue';

import RequestManager from '@/assets/RequestManager.json';

export async function sendRequestTransaction(
  signer: DeepReadonly<JsonRpcSigner>,
  requestManagerAddress: string,
  targetChainId: BigNumber,
  sourceTokenAddress: string,
  targetTokenAddress: string,
  targetAddress: string,
  amount: BigNumber,
): Promise<TransactionReceipt> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);
  const fee = await requestManagerContract.totalFee();
  const transaction: TransactionResponse = await requestManagerContract.createRequest(
    targetChainId,
    sourceTokenAddress,
    targetTokenAddress,
    targetAddress,
    amount,
    { value: fee },
  );
  return await transaction.wait();
}
