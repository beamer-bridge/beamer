import type { Block, JsonRpcSigner } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { ContractInterface } from 'ethers';
import { Contract } from 'ethers';

import type { EthereumAddress } from '@/types/data';

export async function getLatestBlock(rpcUrl: string): Promise<Block> {
  const provider = getJsonRpcProvider(rpcUrl);
  return await provider.getBlock('latest');
}

export async function getCurrentBlockNumber(rpcUrl: string): Promise<number> {
  const provider = getJsonRpcProvider(rpcUrl);
  return provider.getBlockNumber();
}

export function getJsonRpcProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

export function getReadOnlyContract<T>(
  address: EthereumAddress,
  ABI: ContractInterface,
  provider: JsonRpcProvider,
): T {
  return new Contract(address, ABI, provider) as unknown as T;
}

export function getReadWriteContract<T>(
  address: EthereumAddress,
  ABI: ContractInterface,
  signer: JsonRpcSigner,
): T {
  return new Contract(address, ABI, signer) as unknown as T;
}
