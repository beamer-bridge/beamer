import * as providers from '@ethersproject/providers';
import * as ethers from 'ethers';

import {
  CONFIRMATION_TIME_BLOCKS,
  getBlockTimestamp,
  getCurrentBlockNumber,
  getJsonRpcProvider,
  getLatestBlock,
  getReadOnlyContract,
  getReadWriteContract,
  getSafeEventHandler,
} from '@/services/transactions/utils';
import { getRandomEthereumAddress, getRandomUrl } from '~/utils/data_generators';
import { MockedBlock, MockedEvent, MockedTransactionReceipt } from '~/utils/mocks/ethers';

vi.mock('@ethersproject/providers');
vi.mock('ethers');

describe('utils', () => {
  describe('getSafeEventHandler()', () => {
    it('returns a function that wraps the handler with additional functionality', async () => {
      const eventTxHash = '0x123';
      const event = new MockedEvent({ removed: 0, transactionHash: eventTxHash });
      const handler = vi.fn();

      const provider = new providers.JsonRpcProvider();
      provider.getNetwork = vi.fn().mockResolvedValue({ chainId: 1 });
      provider.waitForTransaction = vi
        .fn()
        .mockResolvedValue(new MockedTransactionReceipt({ status: 1 }));

      const safeHandler = getSafeEventHandler(handler, provider);
      expect(safeHandler).toBeTypeOf('function');

      await safeHandler(event);
      expect(handler).toHaveBeenCalledWith(event);
    });
    describe('returned safe event handler', () => {
      it('on call waits until event transaction has been finalized before running the related action', async () => {
        const confirmationTimeBlocks = 5;
        const chainId = 100;
        const eventTxHash = '0x123';
        const event = new MockedEvent({ removed: 0, transactionHash: eventTxHash });
        const handler = vi.fn();

        CONFIRMATION_TIME_BLOCKS[chainId] = confirmationTimeBlocks;

        const provider = new providers.JsonRpcProvider();
        provider.getNetwork = vi.fn().mockResolvedValue({ chainId });
        provider.waitForTransaction = vi
          .fn()
          .mockResolvedValue(new MockedTransactionReceipt({ status: 1 }));

        const safeHandler = getSafeEventHandler(handler, provider);
        await safeHandler(event);

        expect(provider.getNetwork).toHaveBeenCalled();
        expect(provider.waitForTransaction).toHaveBeenCalledWith(
          event.transactionHash,
          confirmationTimeBlocks,
        );
        expect(handler).toHaveBeenCalled();
      });

      describe('in case of re-org', () => {
        it('ignores the duplicate event coming from the re-orged block', async () => {
          const confirmationTimeBlocks = 5;
          const chainId = 100;
          const eventTxHash = '0x123';
          const event = new MockedEvent({ removed: 0, transactionHash: eventTxHash });
          const reorgedEvent = new MockedEvent({ removed: 1, transactionHash: eventTxHash });

          CONFIRMATION_TIME_BLOCKS[chainId] = confirmationTimeBlocks;
          const handler = vi.fn();

          const provider = new providers.JsonRpcProvider();
          provider.getNetwork = vi.fn().mockResolvedValue({ chainId });
          provider.waitForTransaction = vi
            .fn()
            .mockResolvedValue(new MockedTransactionReceipt({ status: 1 }));

          const safeHandler = getSafeEventHandler(handler, provider);

          await safeHandler(event);
          expect(handler).toHaveBeenCalled();

          handler.mockReset();

          await safeHandler(reorgedEvent);
          expect(handler).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('getLatestBlock()', () => {
    it('returns the latest block for the network found on the provided RPC url', () => {
      const rpcUrl = getRandomUrl('rpc');
      const getBlock = vi.fn();

      Object.defineProperty(providers, 'JsonRpcProvider', {
        value: vi
          .fn()
          .mockReturnValue({ getBlock, getNetwork: vi.fn().mockReturnValue({ then: vi.fn() }) }),
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
        value: vi.fn().mockReturnValue({
          getBlockNumber: vi.fn().mockReturnValue(blockNumber),
          getNetwork: vi.fn().mockReturnValue({ then: vi.fn() }),
        }),
      });

      await expect(getCurrentBlockNumber(rpcUrl)).resolves.toBe(100);
    });
  });

  describe('getBlockTimestamp()', () => {
    it('fetches & returns the timestamp for the provided blockHash', async () => {
      const rpcUrl = getRandomUrl('rpc');
      const blockHash = '0x123';
      const blockTimestamp = 100;

      Object.defineProperty(providers, 'JsonRpcProvider', {
        value: vi.fn().mockReturnValue({
          getBlock: vi.fn().mockReturnValue(new MockedBlock({ timestamp: blockTimestamp })),
          getNetwork: vi.fn().mockReturnValue({ then: vi.fn() }),
        }),
      });

      await expect(getBlockTimestamp(rpcUrl, blockHash)).resolves.toBe(100);
    });
  });

  describe('getJsonRpcProvider()', () => {
    it('returns a json rpc provider instance for provided rpc url', () => {
      const rpcUrl = getRandomUrl('rpcurl');

      Object.defineProperty(providers, 'JsonRpcProvider', {
        value: vi.fn().mockReturnValue({
          getNetwork: vi.fn().mockReturnValue({ then: vi.fn() }),
        }),
      });

      getJsonRpcProvider(rpcUrl);
      expect(providers.JsonRpcProvider).toHaveBeenCalledWith(rpcUrl);
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
