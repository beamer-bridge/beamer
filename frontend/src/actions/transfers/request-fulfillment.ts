import type { Encodable } from '@/types/encoding';

export class RequestFulfillment implements Encodable<RequestFulfillmentData> {
  readonly timestamp: number;

  constructor(data: RequestFulfillmentData) {
    this.timestamp = data.timestamp;
  }

  public encode(): RequestFulfillmentData {
    return {
      timestamp: this.timestamp,
    };
  }
}

export type RequestFulfillmentData = {
  timestamp: number;
};
