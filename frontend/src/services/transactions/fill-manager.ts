import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { Ref } from 'vue';

import FillManager from '@/assets/FillManager.json';
import { Request, RequestState } from '@/types/data';

export async function waitForRequestFulfillment(
  provider: JsonRpcProvider, // TODO: This type is an exception till refactoring.
  fillManagerAddress: string,
  request: Request,
  requestState: Ref<RequestState>,
) {
  requestState.value = RequestState.WaitFulfill;
  try {
    await listenOnFulfillment(provider, request, fillManagerAddress);
  } catch (exception) {
    requestState.value = RequestState.RequestFailed;
    throw exception;
  }
  requestState.value = RequestState.RequestSuccessful;
}

async function listenOnFulfillment(
  targetNetworkProvider: JsonRpcProvider,
  request: Request,
  fillManagerAddress: string,
): Promise<void> {
  const currentBlockNumber = await targetNetworkProvider.getBlockNumber();
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
      reject(
        new Error(
          'It looks like it will take longer than expected! Please check your balances later!',
        ),
      );
    }, eventListeningTimeout);
  });

  return Promise.race([fulfillmentPromise, timeoutPromise]).finally(() => {
    fillManagerContract.removeAllListeners(eventFilter);
  });
}

export async function waitForFulfillment(
  targetNetworkProvider: JsonRpcProvider,
  requestIdentifier: number,
  fillManagerAddress: string,
): Promise<void> {
  const fillManagerContract = new Contract(
    fillManagerAddress,
    FillManager.abi,
    targetNetworkProvider,
  );

  const currentBlockNumber = await targetNetworkProvider.getBlockNumber();
  const eventFilter = fillManagerContract.filters.RequestFilled(BigNumber.from(requestIdentifier));
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
      reject(
        new Error(
          'It looks like it will take longer than expected! Please check your balances later!',
        ),
      );
    }, eventListeningTimeout);
  });

  return Promise.race([fulfillmentPromise, timeoutPromise]).finally(() => {
    fillManagerContract.removeAllListeners(eventFilter);
  });
}
