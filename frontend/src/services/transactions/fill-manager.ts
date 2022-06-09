import { JsonRpcProvider } from '@ethersproject/providers';
import type { EventFilter } from 'ethers';
import { BigNumber, Contract } from 'ethers';

import FillManager from '@/assets/FillManager.json';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress } from '@/types/data';
import type { UInt256 } from '@/types/uint-256';

function getContract(rpcUrl: string, address: EthereumAddress): Contract {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Contract(address, FillManager.abi, provider);
}

export async function getCurrentBlockNumber(rpcUrl: string): Promise<number> {
  const provider = new JsonRpcProvider(rpcUrl);
  return provider.getBlockNumber();
}

export async function fetchUntilFirstMatchingEvent(
  contract: {
    queryFilter: (event: EventFilter, from: number, to: number) => Promise<Array<unknown>>;
  },
  filter: EventFilter,
  fromBlockNumber: number,
  toBlockNumber: number,
  blockChunkSize = 2,
): Promise<boolean> {
  while (fromBlockNumber <= toBlockNumber) {
    const targetBlockNumber = Math.min(fromBlockNumber + blockChunkSize, toBlockNumber);

    try {
      const events = await contract.queryFilter(filter, fromBlockNumber, targetBlockNumber);

      if (events.length > 0) {
        return true;
      } else {
        fromBlockNumber = targetBlockNumber + 1;
      }
    } catch (error: unknown) {
      // TODO: Match certain errors? But what to do then? We can't simply fail.
      console.error(error); // For debugging and learning purpose.
      blockChunkSize = Math.floor(blockChunkSize / 2);
    }
  }

  return false;
}

export async function checkForPastFulfillmentEvent(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: UInt256,
  fromBlockNumber: number,
): Promise<boolean> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = getContract(rpcUrl, fillManagerAddress);
  const currentBlockNumber = await provider.getBlockNumber();
  const filter = contract.filters.RequestFilled(BigNumber.from(requestIdentifier.asString));
  return fetchUntilFirstMatchingEvent(contract, filter, fromBlockNumber, currentBlockNumber);
}

export function waitForFulfillment(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: UInt256,
  fromBlockNumber: number,
): Cancelable<void> {
  const contract = getContract(rpcUrl, fillManagerAddress);
  const eventFilter = contract.filters.RequestFilled(BigNumber.from(requestIdentifier.asString));
  const promise = new Promise<void>((resolve) => {
    const cleanUpAndResolve = () => {
      contract.removeAllListeners();
      resolve();
    };

    contract.on(eventFilter, cleanUpAndResolve);

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
