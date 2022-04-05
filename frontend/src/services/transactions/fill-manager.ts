import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from 'ethers';

import FillManager from '@/assets/FillManager.json';
import { Request } from '@/types/data';

export async function listenOnFulfillment(
  targetNetworkProvider: JsonRpcProvider,
  request: Request,
  fillManagerAddress: string,
  currentBlockNumber: number,
): Promise<void> {
  const fillManagerContract = new Contract(
    fillManagerAddress,
    FillManager.abi,
    targetNetworkProvider,
  );

  const eventFilter = fillManagerContract.filters.RequestFilled(request.requestId);
  const events = await fillManagerContract.queryFilter(eventFilter, currentBlockNumber - 500);
  if (events.length > 0) return;

  const eventListeningTimeout = 1000 * 30;

  const fulfillmentPromise: Promise<void> = new Promise((resolve) => {
    fillManagerContract.on(eventFilter, () => {
      resolve();
    });
  });

  const timeoutPromise: Promise<never> = new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Timeout while waiting for fulfillment acknowledgement!'));
    }, eventListeningTimeout);
  });

  return Promise.race([fulfillmentPromise, timeoutPromise])
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      fillManagerContract.removeAllListeners(eventFilter);
    });
}
