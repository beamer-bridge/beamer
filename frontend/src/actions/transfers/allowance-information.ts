import type { TransactionHash } from '@/types/data';
import type { Encodable } from '@/types/encoding';

import { TransactionInformation } from './transaction-information';

export class AllowanceInformation
  extends TransactionInformation
  implements Encodable<AllowanceInformationData>
{
  constructor(data: AllowanceInformationData) {
    super({
      transactionHash: data.transactionHash ?? undefined,
      internalTransactionHash: data.internalTransactionHash ?? undefined,
    });
  }

  public encode(): AllowanceInformationData {
    return {
      transactionHash: this.transactionHash,
      internalTransactionHash: this.internalTransactionHash,
    };
  }
}

export type AllowanceInformationData = {
  transactionHash?: TransactionHash;
  internalTransactionHash?: TransactionHash;
};
