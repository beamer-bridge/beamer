import { sendRequestTransaction, withdrawRequest } from '@/services/transactions/request-manager';
import { ensureTokenAllowance, isAllowanceApproved } from '@/services/transactions/token';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress } from '@/types/data';
import { UInt256 } from '@/types/uint-256';

import { type TransferData, Transfer } from './transfer';

export class SubsidizedTransfer extends Transfer {
  readonly feeSubAddress: string;

  constructor(data: SubsidizedTransferData) {
    if (!data.sourceChain.feeSubAddress) {
      throw new Error('Please provide a fee subsidy contract address.');
    }
    super(data);
    this.feeSubAddress = data.sourceChain.feeSubAddress;
    Object.assign(this.fees.uint256, this.fees.uint256.multiply(new UInt256(0)));
  }

  protected async callWithdrawRequest(
    provider: IEthereumProvider,
    requestIdentifier: string,
  ): Promise<void> {
    await withdrawRequest(provider, this.feeSubAddress, requestIdentifier);
  }

  protected async callEnsureTokenAllowance(
    provider: IEthereumProvider,
    tokenAddress: string,
    amount: UInt256,
  ): Promise<string | undefined> {
    return await ensureTokenAllowance(provider, tokenAddress, this.feeSubAddress, amount);
  }

  protected async callIsAllowanceApproved(
    provider: IEthereumProvider,
    tokenAddress: string,
    ownerAddress: string,
    amount: UInt256,
  ): Promise<boolean> {
    return await isAllowanceApproved(
      provider,
      tokenAddress,
      ownerAddress,
      this.feeSubAddress,
      amount,
    );
  }

  protected async callSendRequestTransaction(
    provider: IEthereumProvider,
    amount: UInt256,
    targetChainIdentifier: number,
    sourceTokenAddress: EthereumAddress,
    targetTokenAddress: EthereumAddress,
    targetAccount: EthereumAddress,
    validityPeriod: UInt256,
  ): Promise<string> {
    return await sendRequestTransaction(
      provider,
      amount,
      targetChainIdentifier,
      this.feeSubAddress,
      sourceTokenAddress,
      targetTokenAddress,
      targetAccount,
      validityPeriod,
    );
  }

  public encode(): SubsidizedTransferData {
    const encodedTransferData = super.encode();
    return {
      ...encodedTransferData,
      feeSubAddress: this.feeSubAddress,
    };
  }
}

export type SubsidizedTransferData = TransferData & {
  feeSubAddress: string;
};

export function isSubsidizedTransferData(
  data: TransferData | SubsidizedTransferData,
): data is SubsidizedTransferData {
  return !!(data as SubsidizedTransferData).feeSubAddress;
}

export function isSubsidizedTransfer(
  transfer: Transfer | SubsidizedTransfer,
): transfer is SubsidizedTransfer {
  return !!(transfer as SubsidizedTransfer).feeSubAddress;
}
