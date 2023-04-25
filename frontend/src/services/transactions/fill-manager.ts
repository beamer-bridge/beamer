import FillManagerDeployment from '@/assets/FillManager.json';
import {
  getBlockTimestamp,
  getCurrentBlockNumber,
  getJsonRpcProvider,
  getReadOnlyContract,
  getSafeEventHandler,
} from '@/services/transactions/utils';
import type { Cancelable } from '@/types/async';
import type { FillManager } from '@/types/ethers-contracts';
import type { RequestFilledEvent } from '@/types/ethers-contracts/FillManager';

import { fetchFirstMatchingEvent } from '../events/filter-utils';

export async function fetchPastFulfillmentEvent(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: string,
  fromBlockNumber: number,
): Promise<RequestFilledEvent | undefined> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManagerDeployment.abi,
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
): Cancelable<number> {
  const contract = getReadOnlyContract<FillManager>(
    fillManagerAddress,
    FillManagerDeployment.abi,
    getJsonRpcProvider(rpcUrl),
  );
  const promise = new Promise<number>((resolve) => {
    const cleanUpAndResolve = (result: number) => {
      contract.removeAllListeners();
      resolve(result);
    };

    const eventHandler = async (...args: Array<unknown>) => {
      const event = args[args.length - 1] as RequestFilledEvent;
      const timestamp = await getBlockTimestamp(rpcUrl, event.blockHash);
      cleanUpAndResolve(timestamp);
    };

    const eventFilter = contract.filters.RequestFilled(requestIdentifier);
    contract.on(eventFilter, getSafeEventHandler(eventHandler, contract.provider));

    fetchPastFulfillmentEvent(rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber).then(
      (event) => {
        if (event) {
          eventHandler(event);
        }
      },
    );
  });

  const cancel = () => contract.removeAllListeners();
  return { promise, cancel };
}
