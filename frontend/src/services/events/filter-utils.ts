import type { EventFilter } from 'ethers';

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
