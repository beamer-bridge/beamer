import type { EthereumAddress } from '@/types/data';
import type { Encodable } from '@/types/encoding';

import type { TransactionInformationData } from './transaction-information';
import { TransactionInformation } from './transaction-information';

export class RequestInformation
  extends TransactionInformation
  implements Encodable<RequestInformationData>
{
  readonly requestAccount: EthereumAddress;
  private _blockNumberOnTargetChain: number;
  private _timestamp?: number;
  private _identifier?: string;

  constructor(data: RequestInformationData) {
    super({
      internalTransactionHash: data.internalTransactionHash,
      transactionHash: data.transactionHash,
    });
    this.requestAccount = data.requestAccount;
    this._blockNumberOnTargetChain = data.blockNumberOnTargetChain ?? 0;
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

  get blockNumberOnTargetChain(): number {
    return this._blockNumberOnTargetChain;
  }

  public setBlockNumberOnTargetChain(value: number): void {
    if (this._blockNumberOnTargetChain === 0) {
      this._blockNumberOnTargetChain = value;
    } else {
      throw new Error(
        'Attempt to overwrite already existing block number on target chain of a request!',
      );
    }
  }

  public encode(): RequestInformationData {
    return {
      requestAccount: this.requestAccount,
      transactionHash: this.transactionHash,
      internalTransactionHash: this.internalTransactionHash,
      blockNumberOnTargetChain: this.blockNumberOnTargetChain,
      timestamp: this.timestamp,
      identifier: this.identifier,
    };
  }
}

export type RequestInformationData = TransactionInformationData & {
  requestAccount: EthereumAddress;
  blockNumberOnTargetChain?: number;
  timestamp?: number;
  identifier?: string;
};
