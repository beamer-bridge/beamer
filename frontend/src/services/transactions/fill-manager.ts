import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';

import FillManager from '@/assets/FillManager.json';
import type { UInt256 } from '@/types/uint-256';

export async function waitForFulfillment(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: UInt256,
): Promise<void> {
  const provider = new JsonRpcProvider(rpcUrl);
  const fillManagerContract = new Contract(fillManagerAddress, FillManager.abi, provider);

  const currentBlockNumber = await provider.getBlockNumber();
  const eventFilter = fillManagerContract.filters.RequestFilled(
    BigNumber.from(requestIdentifier.asString),
  );
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
