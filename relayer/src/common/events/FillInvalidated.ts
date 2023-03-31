import type { Log } from "@ethersproject/providers";
import { Interface } from "ethers/lib/utils";

import FillManagerABI from "../../assets/abi/FillManager.json";

interface Result extends ReadonlyArray<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FillInvalidatedEventData extends Result {
  requestId: string;
  fillId: string;
}

export const isValidFillInvalidatedEvent = (data: Result): data is FillInvalidatedEventData => {
  const eventData = data as FillInvalidatedEventData;

  return !!eventData.requestId && !!eventData.fillId;
};

export const parseFillInvalidatedEvent = (logs: Log[]): FillInvalidatedEventData | null => {
  const iface = new Interface(FillManagerABI);

  for (const log of logs) {
    try {
      const decodedData = iface.decodeEventLog("FillInvalidated", log.data, log.topics);
      if (isValidFillInvalidatedEvent(decodedData)) {
        return decodedData;
      }
    } catch (exception) {
      // continue until a match was found (if any)
      continue;
    }
  }

  return null;
};
