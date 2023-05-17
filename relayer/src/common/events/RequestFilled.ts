import type { Log } from "@ethersproject/providers";
import type { BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils";

import FillManagerABI from "../../assets/abi/FillManager.json";
import { isUndefined } from "../util";

interface Result extends ReadonlyArray<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface RequestFilledEventData extends Result {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  targetTokenAddress: string;
  filler: string;
  amount: BigNumber;
}

export const isValidRequestFilledEventData = (data: Result): data is RequestFilledEventData => {
  const eventData = data as RequestFilledEventData;

  return (
    !isUndefined(eventData.requestId) &&
    !isUndefined(eventData.fillId) &&
    !isUndefined(eventData.sourceChainId) &&
    !isUndefined(eventData.targetTokenAddress) &&
    !isUndefined(eventData.filler) &&
    !isUndefined(eventData.amount)
  );
};

export const parseRequestFilledEvent = (logs: Log[]): RequestFilledEventData | null => {
  const iface = new Interface(FillManagerABI);

  for (const log of logs) {
    try {
      const decodedData = iface.decodeEventLog("RequestFilled", log.data, log.topics);
      if (isValidRequestFilledEventData(decodedData)) {
        return decodedData;
      }
    } catch (exception) {
      // continue until a match was found (if any)
      continue;
    }
  }

  return null;
};
