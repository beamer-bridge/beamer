import type { Event, EventFilter } from "ethers";

import { sleep } from "../util";

export async function fetchFirstMatchingEvent<E extends Event>(
  contract: {
    queryFilter: (event: EventFilter, from: number, to: number) => Promise<Array<unknown>>;
  },
  filter: EventFilter,
  fromBlockNumber: number,
  toBlockNumber: number,
  argumentChecks: Record<string, unknown> = {},
  blockChunkSize = 500,
): Promise<E | undefined> {
  while (fromBlockNumber <= toBlockNumber) {
    const targetBlockNumber = Math.min(fromBlockNumber + blockChunkSize, toBlockNumber);

    try {
      const events = (await contract.queryFilter(
        filter,
        fromBlockNumber,
        targetBlockNumber,
      )) as E[];

      if (events.length > 0) {
        const event = events.find((e) => {
          let matches = true;
          for (const [key, value] of Object.entries(argumentChecks)) {
            if (!e.args || e.args[key] !== value) {
              matches = false;
            }
          }
          return matches;
        });
        if (event) {
          return event;
        }
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
