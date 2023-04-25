import type { Encodable } from '@/types/encoding';

export class RequestFulfillment implements Encodable<RequestFulfillmentData> {
  private _timestamp: number;

  constructor(data: RequestFulfillmentData) {
    this._timestamp = data.timestamp;
  }

  get timestamp(): number | undefined {
    return this._timestamp;
  }

  public setTimestamp(value: number): void {
    if (this._timestamp === undefined) {
      this._timestamp = value;
    } else {
      throw new Error('Attempt to overwrite already set timestamp of a request fulfillment!');
    }
  }

  public encode(): RequestFulfillmentData {
    return {
      timestamp: this._timestamp,
    };
  }
}

export type RequestFulfillmentData = {
  timestamp: number;
};
