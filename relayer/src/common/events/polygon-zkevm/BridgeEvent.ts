import type { Log } from "@ethersproject/providers";
import type { BigNumber } from "ethers";

import { PolygonZKEvmBridge__factory } from "../../../../types-gen/contracts/external/";
import { isUndefined } from "../../util";

interface Result extends ReadonlyArray<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface BridgeEventData extends Result {
  leafType: number;
  originNetwork: number;
  originAddress: string;
  destinationNetwork: number;
  destinationAddress: string;
  amount: BigNumber;
  metadata: string;
  depositCount: number;
}

export const isValidBridgeEventData = (data: Result): data is BridgeEventData => {
  const eventData = data as BridgeEventData;

  return (
    !isUndefined(eventData.leafType) &&
    !isUndefined(eventData.originNetwork) &&
    !isUndefined(eventData.originAddress) &&
    !isUndefined(eventData.destinationNetwork) &&
    !isUndefined(eventData.destinationAddress) &&
    !isUndefined(eventData.amount) &&
    !isUndefined(eventData.metadata) &&
    !isUndefined(eventData.depositCount)
  );
};

export const parseBridgeEvent = (logs: Log[]): BridgeEventData | null => {
  const iface = PolygonZKEvmBridge__factory.createInterface();

  for (const log of logs) {
    try {
      const decodedData = iface.decodeEventLog("BridgeEvent", log.data, log.topics);
      if (isValidBridgeEventData(decodedData)) {
        return decodedData;
      }
    } catch (exception) {
      // continue until a match was found (if any)
      continue;
    }
  }

  return null;
};
