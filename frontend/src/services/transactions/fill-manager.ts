import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from 'ethers';

import FillManager from '@/assets/FillManager.json';
import { Request } from '@/types/data';

export async function listenOnFulfillment(
  targetNetworkProvider: JsonRpcProvider,
  request: Request,
  fillManagerAddress: string,
  currentBlockNumber: number,
): Promise<string | undefined> {
  const fillManagerContract = new Contract(
    fillManagerAddress,
    FillManager.abi,
    targetNetworkProvider,
  );

  const eventFilter = fillManagerContract.filters.RequestFilled(request.requestId);
  const events = await fillManagerContract.queryFilter(eventFilter, currentBlockNumber - 500);
  if (events.length > 0) return;

  const eventListeningTimeout = 1000 * 30;

  const fulfillmentPromise = new Promise((resolve) => {
    fillManagerContract.on(eventFilter, (fullRequestId) => {
      resolve(fullRequestId);
    });
  });

  const timeoutPromise = new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Timeout!'));
    }, eventListeningTimeout);
  });

  return Promise.race([fulfillmentPromise, timeoutPromise])
    .then((fullRequestId) => {
      return fullRequestId as string;
    })
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      fillManagerContract.removeAllListeners(eventFilter);
    });
}
