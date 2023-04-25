import type { EthereumAddress, TransactionHash } from '@/types/data';
import type { Encodable } from '@/types/encoding';

export class RequestInformation implements Encodable<RequestInformationData> {
  readonly transactionHash: TransactionHash;
  readonly requestAccount: EthereumAddress;
  readonly blockNumberOnTargetChain: number;
  private _timestamp?: number;
  private _identifier?: string;

  constructor(data: RequestInformationData) {
    this.transactionHash = data.transactionHash;
    this.requestAccount = data.requestAccount;
    this.blockNumberOnTargetChain = data.blockNumberOnTargetChain ?? 0;
    this._timestamp = data.timestamp ?? undefined;
    this._identifier = data.identifier ?? undefined;
  }
  get timestamp(): number | undefined {
    return this._timestamp;
  }

  public setTimestamp(value: number): void {
    if (this._timestamp === undefined) {
      this._timestamp = value;
    } else {
      throw new Error('Attempt to overwrite already set timestamp of a request!');
    }
  }

  get identifier(): string | undefined {
    return this._identifier;
  }

  public setIdentifier(value: string): void {
    if (this._identifier === undefined) {
      this._identifier = value;
    } else {
      throw new Error('Attempt to overwrite already existing identifier of a request!');
    }
  }

  public encode(): RequestInformationData {
    return {
      transactionHash: this.transactionHash,
      requestAccount: this.requestAccount,
      blockNumberOnTargetChain: this.blockNumberOnTargetChain,
      timestamp: this.timestamp,
      identifier: this.identifier,
    };
  }
}

export type RequestInformationData = {
  transactionHash: TransactionHash;
  requestAccount: EthereumAddress;
  blockNumberOnTargetChain?: number;
  timestamp?: number;
  identifier?: string;
};
