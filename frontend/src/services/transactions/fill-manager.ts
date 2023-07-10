import {
  getCurrentBlockNumber,
  getJsonRpcProvider,
  getReadOnlyContract,
  getSafeEventHandler,
} from '@/services/transactions/utils';
import type { Cancelable } from '@/types/async';
import { FillManager__factory } from '#contract-factories/FillManager__factory.ts';
import type { FillManager, RequestFilledEvent } from '#contracts/FillManager.ts';

import { fetchFirstMatchingEvent } from '../events/filter-utils';

export async function fetchPastFulfillmentEvent(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: string,
  fromBlockNumber: number,
): Promise<RequestFilledEvent | undefined> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const currentBlockNumber = await getCurrentBlockNumber(rpcUrl);
  const filter = contract.filters.RequestFilled(requestIdentifier);
  return fetchFirstMatchingEvent<RequestFilledEvent>(
    contract,
    filter,
    fromBlockNumber,
    currentBlockNumber,
  );
}
export function waitForFulfillment(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: string,
  fromBlockNumber: number,
): Cancelable<void> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManager__factory.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const promise = new Promise<void>((resolve) => {
    const cleanUpAndResolve = () => {
      contract.removeAllListeners();
      resolve();
    };

    const eventFilter = contract.filters.RequestFilled(requestIdentifier);
    contract.on(eventFilter, getSafeEventHandler(cleanUpAndResolve, contract.provider));

    fetchPastFulfillmentEvent(rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber).then(
      (event) => {
        if (event) {
          cleanUpAndResolve();
        }
      },
    );
  });

  const cancel = () => contract.removeAllListeners();
  return { promise, cancel };
}
