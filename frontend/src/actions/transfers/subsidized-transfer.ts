import type { IEthereumProvider } from '@/services/web3-provider';
import { UInt256 } from '@/types/uint-256';

import { type TransferData, Transfer } from './transfer';

export class SubsidizedTransfer extends Transfer {
  readonly feeSubAddress: string;
  readonly originalRequestManagerAddress: string;

  constructor(data: SubsidizedTransferData) {
    if (!data.sourceChain.feeSubAddress) {
      throw new Error('Please provide a fee subsidy contract address.');
    }
    super(data);
    this.originalRequestManagerAddress = data.sourceChain.requestManagerAddress;
    this.feeSubAddress = data.sourceChain.feeSubAddress;
    Object.assign(this.fees.uint256, this.fees.uint256.multiply(new UInt256(0)));
  }

  async ensureTokenAllowance(provider: IEthereumProvider): Promise<void> {
    if (this.feeSubAddress) {
      this.sourceChain.requestManagerAddress = this.feeSubAddress;
    }
    await super.ensureTokenAllowance(provider);
    this.sourceChain.requestManagerAddress = this.originalRequestManagerAddress;
  }

  async sendRequestTransaction(provider: IEthereumProvider): Promise<void> {
    if (this.feeSubAddress) {
      this.sourceChain.requestManagerAddress = this.feeSubAddress;
    }
    await super.sendRequestTransaction(provider);
    this.sourceChain.requestManagerAddress = this.originalRequestManagerAddress;
  }

  public encode(): SubsidizedTransferData {
    const encodedTransferData = super.encode();
    return {
      ...encodedTransferData,
      feeSubAddress: this.feeSubAddress,
      originalRequestManagerAddress: this.originalRequestManagerAddress,
    };
  }
}

export type SubsidizedTransferData = TransferData & {
  feeSubAddress: string;
  originalRequestManagerAddress: string;
};
