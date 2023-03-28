import type { Block, JsonRpcSigner, Provider } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';
import type { ContractInterface, Event } from 'ethers';
import { Contract } from 'ethers';

import type { EthereumAddress } from '@/types/data';

type ConfirmationTimeMap = {
  [chainId: string]: number;
};

const DEFAULT_CONFIRIMATION_TIME_BLOCKS = 1;
const CONFIRMATION_TIME_BLOCKS: ConfirmationTimeMap = {
  1: 2,
};

export function getSafeEventHandler(
  handler: CallableFunction,
  provider: Provider,
): (...args: Array<unknown>) => Promise<void> {
  return async (...args: Array<unknown>) => {
    const { chainId } = await provider.getNetwork();
    const confirmationTimeBlocks = getConfirmationTimeBlocksForChain(chainId);

    const event = args[arguments.length] as unknown as Event;
    if (event.removed) {
      // Ignoring events coming from re-orged blocks
      return;
    }

    const receipt = await provider.waitForTransaction(
      event.transactionHash,
      confirmationTimeBlocks,
    );

    if (receipt.status) {
      handler(...args);
    } else {
      throw new Error('Transaction reverted on chain.');
    }
  };
}
export function getConfirmationTimeBlocksForChain(chainId: number) {
  return CONFIRMATION_TIME_BLOCKS[chainId] ?? DEFAULT_CONFIRIMATION_TIME_BLOCKS;
}

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
