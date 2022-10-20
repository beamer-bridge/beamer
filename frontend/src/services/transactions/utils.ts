import { JsonRpcProvider } from '@ethersproject/providers';
import type { ContractInterface } from 'ethers';
import { Contract } from 'ethers';

import type { EthereumAddress } from '@/types/data';

export function getContract(
  rpcUrl: string,
  address: EthereumAddress,
  ABI: ContractInterface,
): Contract {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Contract(address, ABI, provider);
}
