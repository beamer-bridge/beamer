import FillManagerDeployment from '@/assets/FillManager.json';
import { fetchUntilFirstMatchingEvent } from '@/services/events/filter-utils';
import {
  getCurrentBlockNumber,
  getJsonRpcProvider,
  getReadOnlyContract,
  getSafeEventHandler,
} from '@/services/transactions/utils';
import type { Cancelable } from '@/types/async';
import type { FillManager } from '@/types/ethers-contracts';

export async function checkForPastFulfillmentEvent(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: string,
  fromBlockNumber: number,
): Promise<boolean> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const currentBlockNumber = await getCurrentBlockNumber(rpcUrl);
  const filter = contract.filters.RequestFilled(requestIdentifier);
  return fetchUntilFirstMatchingEvent(contract, filter, fromBlockNumber, currentBlockNumber);
}

export function waitForFulfillment(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: string,
  fromBlockNumber: number,
): Cancelable<void> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const promise = new Promise<void>((resolve) => {
    const cleanUpAndResolve = () => {
      contract.removeAllListeners();
      resolve();
    };

    const eventFilter = contract.filters.RequestFilled(requestIdentifier);
    contract.on(eventFilter, getSafeEventHandler(cleanUpAndResolve, contract.provider));

    checkForPastFulfillmentEvent(
      rpcUrl,
      fillManagerAddress,
      requestIdentifier,
      fromBlockNumber,
    ).then((fulfilled) => {
      if (fulfilled) {
        cleanUpAndResolve();
      }
    });
  });

  const cancel = () => contract.removeAllListeners();
  return { promise, cancel };
}
