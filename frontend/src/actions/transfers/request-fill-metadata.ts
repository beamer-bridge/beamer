import type { EthereumAddress, TransactionHash } from '@/types/data';

export type RequestFillMetadata = {
  transactionHash: TransactionHash;
  fillerAccount: EthereumAddress;
};
