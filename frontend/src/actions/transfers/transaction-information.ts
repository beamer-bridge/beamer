import type { TransactionHash } from '@/types/data';

export class TransactionInformation {
  private _transactionHash?: TransactionHash;
  private _internalTransactionHash?: TransactionHash;

  constructor(data: TransactionInformationData) {
    this._transactionHash = data.transactionHash ?? undefined;
    this._internalTransactionHash = data.internalTransactionHash ?? undefined;
  }

  get transactionHash(): TransactionHash | undefined {
    return this._transactionHash;
  }

  get internalTransactionHash(): TransactionHash | undefined {
    return this._internalTransactionHash;
  }

  public setTransactionHash(value: TransactionHash): void {
    if (this._transactionHash === undefined) {
      this._transactionHash = value;
    } else {
      throw new Error('Attempt to overwrite already existing transaction hash!');
    }
  }

  public setInternalTransactionHash(value: TransactionHash): void {
    if (this._internalTransactionHash === undefined) {
      this._internalTransactionHash = value;
    } else {
      throw new Error('Attempt to overwrite already existing internal transaction hash!');
    }
  }
}

export type TransactionInformationData = {
  transactionHash?: TransactionHash;
  internalTransactionHash?: TransactionHash;
};
