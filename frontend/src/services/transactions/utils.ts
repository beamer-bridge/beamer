import type { JsonRpcSigner } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { ContractInterface } from 'ethers';
import { Contract } from 'ethers';

import type { EthereumAddress } from '@/types/data';

export async function getCurrentBlockNumber(rpcUrl: string): Promise<number> {
  const provider = getJsonRpcProvider(rpcUrl);
  return provider.getBlockNumber();
}

export function getJsonRpcProvider(rpcUrl: string) {
  return new JsonRpcProvider(rpcUrl);
}

export function getReadOnlyContract(
  address: EthereumAddress,
  ABI: ContractInterface,
  provider: JsonRpcProvider,
): Contract {
  return new Contract(address, ABI, provider);
}

export function getReadWriteContract(
  address: EthereumAddress,
  ABI: ContractInterface,
  signer: JsonRpcSigner,
): Contract {
  return new Contract(address, ABI, signer);
}
