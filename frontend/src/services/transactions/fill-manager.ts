import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly } from 'vue';

import FillManager from '@/assets/FillManager.json';
import { Request } from '@/types/data';

export async function listenOnFulfillment(
  signer: DeepReadonly<JsonRpcSigner>,
  request: Request,
  currentBlockNumber: number,
): Promise<void> {
  const fillManagerContract = new Contract(request.fillManagerAddress, FillManager.abi, signer);

  const eventFilter = fillManagerContract.filters.RequestFilled(
    BigNumber.from(request.requestId),
    BigNumber.from(request.sourceChainId),
    request.targetTokenAddress,
  );
  const events = await fillManagerContract.queryFilter(eventFilter, currentBlockNumber - 1000);
  if (events.length > 0) {
    return;
  }

  return new Promise((resolve) => {
    fillManagerContract.on(eventFilter, () => resolve());
  });
}
