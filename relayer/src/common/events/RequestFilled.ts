import type { Log } from "@ethersproject/providers";
import type { BigNumber } from "ethers";
import type { Result } from "ethers/lib/utils";
import { Interface } from "ethers/lib/utils";

import FillManagerABI from "../../assets/abi/FillManager.json";

interface RequestFilledEventData extends Array<unknown> {
  requestId: string;
  fillId: string;
  sourceChainId: BigNumber;
  targetTokenAddress: string;
  filler: string;
  amount: BigNumber;
  [key: string]: unknown;
}

export const isValidRequestFilledEventData = (data: Result): data is RequestFilledEventData => {
  const eventData = data as RequestFilledEventData;

  return (
    !!eventData.requestId &&
    !!eventData.fillId &&
    !!eventData.sourceChainId &&
    !!eventData.targetTokenAddress &&
    !!eventData.filler &&
    !!eventData.amount
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
