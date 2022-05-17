import type { EthereumAddress, TransactionHash } from '@/types/data';

export type FulfillmentInformation = {
  transactionHash: TransactionHash;
  fillerAccount: EthereumAddress;
};
