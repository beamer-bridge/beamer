import type { EthereumAddress, TransactionHash } from '@/types/data';
import type { Encodable } from '@/types/encoding';
import type { UInt256Data } from '@/types/uint-256';
import { UInt256 } from '@/types/uint-256';

export class RequestMetadata implements Encodable<RequestMetadataData> {
  readonly transactionHash: TransactionHash;
  readonly requestAccount: EthereumAddress;
  private _identifier?: UInt256;

  constructor(data: RequestMetadataData) {
    this.transactionHash = data.transactionHash;
    this.requestAccount = data.requestAccount;
    this._identifier = data.identifier ? new UInt256(data.identifier) : undefined;
  }

  get identifier(): UInt256 | undefined {
    return this._identifier;
  }

  public setIdentifier(value: UInt256): void {
    if (this._identifier === undefined) {
      this._identifier = value;
    } else {
      throw new Error('Attempt to overwrite already existing identifier of a request!');
    }
  }

  public encode(): RequestMetadataData {
    return {
      transactionHash: this.transactionHash,
      requestAccount: this.requestAccount,
      identifier: this.identifier?.encode(),
    };
  }
}

export type RequestMetadataData = {
  transactionHash: TransactionHash;
  requestAccount: EthereumAddress;
  identifier?: UInt256Data;
};
