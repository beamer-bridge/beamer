import * as providers from '@ethersproject/providers';
import * as ethers from 'ethers';

import {
  getCurrentBlockNumber,
  getJsonRpcProvider,
  getLatestBlock,
  getReadOnlyContract,
  getReadWriteContract,
} from '@/services/transactions/utils';
import { getRandomEthereumAddress, getRandomUrl } from '~/utils/data_generators';

vi.mock('@ethersproject/providers');
vi.mock('ethers');

describe('utils', () => {
  describe('getLatestBlock()', () => {
    it('returns the latest block for the network found on the provided RPC url', () => {
      const rpcUrl = getRandomUrl('rpc');
      const getBlock = vi.fn();

      Object.defineProperty(providers, 'JsonRpcProvider', {
        value: vi.fn().mockReturnValue({ getBlock }),
      });

      getLatestBlock(rpcUrl);

      expect(getBlock).toHaveBeenCalledWith('latest');
    });
  });
  describe('getCurrentBlockNumber()', () => {
    it('returns the current block number for the network found on the provided RPC url', async () => {
      const rpcUrl = getRandomUrl('rpc');
      const blockNumber = 100;

      Object.defineProperty(providers, 'JsonRpcProvider', {
        value: vi.fn().mockReturnValue({ getBlockNumber: vi.fn().mockReturnValue(blockNumber) }),
      });

      await expect(getCurrentBlockNumber(rpcUrl)).resolves.toBe(100);
    });
  });

  describe('getJsonRpcProvider()', () => {
    it('returns a json rpc provider instance for provided rpc url', () => {
      const rpcUrl = getRandomUrl('rpcurl');

      const provider = getJsonRpcProvider(rpcUrl);
      expect(providers.JsonRpcProvider).toHaveBeenCalledWith(rpcUrl);
      expect(provider).toBeInstanceOf(providers.JsonRpcProvider);
    });
  });

  describe('getReadOnlyContract()', () => {
    it('returns a read-only contract instance connected to the provided provider', () => {
      const provider = new providers.JsonRpcProvider('rpcurl');
      const contractAddress = getRandomEthereumAddress();
      const ABI = '';

      const contract = getReadOnlyContract(contractAddress, ABI, provider);
      expect(ethers.Contract).toHaveBeenCalledWith(contractAddress, ABI, provider);
      expect(contract).toBeInstanceOf(ethers.Contract);
    });
  });

  describe('getReadWriteContract()', () => {
    it('returns a read/write contract instance connected to the provided signer', () => {
      const provider = new providers.JsonRpcProvider('rpcUrl');
      provider.getSigner = vi.fn();
      const signer = provider.getSigner();
      const contractAddress = getRandomEthereumAddress();
      const ABI = '';

      const contract = getReadWriteContract(contractAddress, ABI, signer);
      expect(ethers.Contract).toHaveBeenCalledWith(contractAddress, ABI, signer);
      expect(contract).toBeInstanceOf(ethers.Contract);
    });
  });
});
