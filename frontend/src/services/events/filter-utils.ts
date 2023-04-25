import type { Event, EventFilter } from 'ethers';

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export async function fetchFirstMatchingEvent<E extends Event>(
  contract: {
    queryFilter: (event: EventFilter, from: number, to: number) => Promise<Array<unknown>>;
  },
  filter: EventFilter,
  fromBlockNumber: number,
  toBlockNumber: number,
  blockChunkSize = 500,
): Promise<E | undefined> {
  while (fromBlockNumber <= toBlockNumber) {
    const targetBlockNumber = Math.min(fromBlockNumber + blockChunkSize, toBlockNumber);

    try {
      const events = await contract.queryFilter(filter, fromBlockNumber, targetBlockNumber);

      if (events.length > 0) {
        return events[0] as E;
      } else {
        fromBlockNumber = targetBlockNumber + 1;
      }
    } catch (error: unknown) {
      // TODO: Match certain errors? But what to do then? We can't simply fail.
      console.error(error); // For debugging and learning purpose.
      blockChunkSize = Math.floor(blockChunkSize / 2);
    }
    await sleep(5000);
  }

  return undefined;
}
