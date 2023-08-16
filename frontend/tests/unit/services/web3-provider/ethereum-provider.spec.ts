import * as providers from '@ethersproject/providers';
import type { Mock } from 'vitest';

import type { Eip1193Provider } from '@/services/web3-provider';
import { BasicEthereumWallet, EthereumWallet } from '@/services/web3-provider/ethereum-provider';
import { generateChain, generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEip1193Provider, MockedWeb3Provider } from '~/utils/mocks/ethereum-provider';
import { MockedTransactionReceipt } from '~/utils/mocks/ethers';

vi.mock('@ethersproject/providers');
vi.mock('ethers');

class TestBasicEthereumWallet extends BasicEthereumWallet<Eip1193Provider> {
  constructor(_provider: Eip1193Provider = new MockedEip1193Provider()) {
    super(_provider);
  }
}

class TestEthereumProvider extends EthereumWallet<Eip1193Provider> {
  constructor(_provider: Eip1193Provider = new MockedEip1193Provider()) {
    super(_provider);
  }

  switchChain = vi.fn();
}

function mockWeb3Provider() {
  const web3Provider = new MockedWeb3Provider();

  Object.defineProperty(providers, 'Web3Provider', {
    value: vi.fn().mockImplementation(() => web3Provider),
  });

  return web3Provider;
}

describe('BasicEthereumProvider', () => {
  beforeEach(() => {
    mockWeb3Provider();
    global.console.error = vi.fn();
  });

  describe('init()', () => {
    it('initializes the provider by setting the right initial values', async () => {
      const chain = generateChain({ identifier: 2 });
      const signerAddress = getRandomEthereumAddress();
      const signer = 'fake-signer';

      const web3Provider = mockWeb3Provider();
      web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
      web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);
      web3Provider.getSigner = vi.fn().mockReturnValue(signer);

      const ethereumProvider = new TestBasicEthereumWallet();

      expect(ethereumProvider.signer.value).toBeUndefined();
      expect(ethereumProvider.signerAddress.value).toBeUndefined();
      expect(ethereumProvider.chainId.value).toBe(1);

      await ethereumProvider.init();

      expect(ethereumProvider.signer.value).toBe(signer);
      expect(ethereumProvider.signerAddress.value).toBe(signerAddress);
      expect(ethereumProvider.chainId.value).toBe(chain.identifier);
    });
  });

  describe('getLatestBlock()', () => {
    it('returns the latest block for the connected wallet provider', async () => {
      const latestBlock = 100;

      const web3Provider = mockWeb3Provider();
      web3Provider.getBlock = vi.fn().mockReturnValue(latestBlock);

      const ethereumProvider = new TestBasicEthereumWallet();
      const result = await ethereumProvider.getLatestBlock();

      expect(web3Provider.getBlock).toHaveBeenNthCalledWith(1, 'latest');
      expect(result).toBe(100);
    });
  });

  describe('getProvider()', () => {
    it('returns the attached web3 provider object', () => {
      const web3Provider = mockWeb3Provider();

      const ethereumProvider = new TestBasicEthereumWallet();
      const result = ethereumProvider.getProvider();

      expect(result).toBe(web3Provider);
    });
  });

  describe('getChainId()', () => {
    it('returns the connected chain id', async () => {
      const connectedChainId = 1;

      const web3Provider = mockWeb3Provider();
      web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: connectedChainId });

      const ethereumProvider = new TestBasicEthereumWallet();
      const result = await ethereumProvider.getChainId();

      expect(result).toBe(connectedChainId);
    });
  });

  describe('tryAccessingDefaultSigner()', () => {
    it('disconnects the previously connected wallet address when there are no addresses connected', async () => {
      const web3Provider = mockWeb3Provider();
      web3Provider.listAccounts = vi.fn().mockReturnValue([]);

      const ethereumProvider = new TestBasicEthereumWallet();
      await ethereumProvider.tryAccessingDefaultSigner();

      expect(ethereumProvider.signer.value).toBe(undefined);
      expect(ethereumProvider.signerAddress.value).toBe(undefined);
    });
    it('tries connecting to the first accessible connected wallet address', async () => {
      const firstAddress = getRandomEthereumAddress();

      const web3Provider = mockWeb3Provider();
      web3Provider.listAccounts = vi
        .fn()
        .mockReturnValue([firstAddress, getRandomEthereumAddress()]);
      web3Provider.getSigner = vi.fn().mockReturnValue('fake-signer');

      const ethereumProvider = new TestBasicEthereumWallet();
      await ethereumProvider.tryAccessingDefaultSigner();

      expect(ethereumProvider.signer.value).toBe('fake-signer');
      expect(ethereumProvider.signerAddress.value).toBe(firstAddress);
    });
  });

  describe('waitForTransaction()', () => {
    it('waits until given transaction has been confirmed/mined on chain', async () => {
      const receipt = new MockedTransactionReceipt();
      const web3Provider = mockWeb3Provider();
      web3Provider.waitForTransaction = vi.fn().mockReturnValue(receipt);

      const ethereumProvider = new TestBasicEthereumWallet();
      const transactionHash = await ethereumProvider.waitForTransaction(receipt.transactionHash);

      expect(transactionHash).toBe(receipt.transactionHash);
    });
    it('throws when transaction has reverted on chain', async () => {
      const receipt = new MockedTransactionReceipt({ status: 0 });
      const web3Provider = mockWeb3Provider();
      web3Provider.waitForTransaction = vi.fn().mockReturnValue(receipt);

      const ethereumProvider = new TestBasicEthereumWallet();
      expect(() => ethereumProvider.waitForTransaction(receipt.transactionHash)).rejects.toThrow(
        `Transaction ${receipt.transactionHash} reverted on chain.`,
      );
    });
  });

  describe('setSigner()', () => {
    it('sets the provided account address as the new signer', () => {
      const signerAddrees = getRandomEthereumAddress();
      const web3Provider = mockWeb3Provider();
      web3Provider.getSigner = vi.fn().mockReturnValue('fake-signer');

      const ethereumProvider = new TestBasicEthereumWallet();
      ethereumProvider.setSigner(signerAddrees);

      expect(ethereumProvider.signer.value).toBe('fake-signer');
      expect(ethereumProvider.signerAddress.value).toBe(signerAddrees);
    });
  });

  describe('disconnect()', () => {
    it('disconnects the previously set signer', () => {
      const web3Provider = mockWeb3Provider();
      web3Provider.getSigner = vi.fn().mockImplementation((signer) => signer);

      const ethereumProvider = new TestBasicEthereumWallet();
      ethereumProvider.setSigner(getRandomEthereumAddress());

      expect(ethereumProvider.signer.value).not.toBeUndefined();
      expect(ethereumProvider.signerAddress.value).not.toBeUndefined();

      ethereumProvider.disconnect();

      expect(ethereumProvider.signer.value).toBeUndefined();
      expect(ethereumProvider.signerAddress.value).toBeUndefined();
    });
  });

  describe('listenToEvents()', () => {
    it('attaches necessary event listeners for the wallet provider', () => {
      const eipProvider = new MockedEip1193Provider();
      const ethereumProvider = new TestBasicEthereumWallet(eipProvider);

      ethereumProvider.listenToEvents();

      expect(eipProvider.on).toHaveBeenCalledWith('accountsChanged', expect.anything());
      expect(ethereumProvider['web3Provider'].on).toHaveBeenCalledWith(
        'network',
        expect.anything(),
      );
      expect(eipProvider.on).toHaveBeenCalledWith('disconnect', expect.anything());
    });

    it('attaches an event listener which triggers a location.replace on network change', () => {
      const originalReplace = window.location.replace;
      const mockReplace = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { replace: mockReplace },
      });
      const eipProvider = new MockedEip1193Provider();
      const ethereumProvider = new TestBasicEthereumWallet(eipProvider);
      ethereumProvider.listenToEvents();

      let networkEventCallback;
      const listenerCalls = (ethereumProvider['web3Provider'].on as Mock).mock.calls;
      for (const call of listenerCalls) {
        if (call[0] === 'network') {
          networkEventCallback = call[1];
        }
      }
      expect(networkEventCallback).not.toBeUndefined();

      networkEventCallback({ chainId: 5 }, { chainId: 10 });

      expect(mockReplace).toHaveBeenCalledWith(window.location.pathname);

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { reload: originalReplace },
      });
    });
  });
});

describe('EthereumProvider', () => {
  beforeEach(() => {
    mockWeb3Provider();
    global.console.error = vi.fn();
  });

  describe('switchChainSafely()', () => {
    it('initiates a wallet provider chain switch action', async () => {
      const currentChainId = 1;
      const newChainId = 2;
      const chain = generateChain({ identifier: newChainId });

      const ethereumProvider = new TestEthereumProvider();
      ethereumProvider.chainId.value = currentChainId;
      ethereumProvider.switchChain = vi.fn().mockReturnValue(true);

      await ethereumProvider.switchChainSafely(chain);

      expect(ethereumProvider.switchChain).toHaveBeenNthCalledWith(1, newChainId);
    });

    describe('when chain is not recognized by wallet provider', () => {
      it('triggers a call to add chain to wallet configuration', async () => {
        const currentChainId = 1;
        const newChainId = 2;
        const chain = generateChain({ identifier: newChainId });

        const web3Provider = mockWeb3Provider();
        const ethereumProvider = new TestEthereumProvider();
        ethereumProvider.chainId.value = currentChainId;
        ethereumProvider.switchChain = vi.fn().mockReturnValue(false);

        await ethereumProvider.switchChainSafely(chain);

        expect(web3Provider.send).toHaveBeenNthCalledWith(
          1,
          'wallet_addEthereumChain',
          expect.anything(),
        );
      });
    });

    it('returns true if chain switch was successful', async () => {
      const currentChainId = 1;
      const newChainId = 2;
      const chain = generateChain({ identifier: newChainId });

      const ethereumProvider = new TestEthereumProvider();
      ethereumProvider.chainId.value = currentChainId;
      ethereumProvider.switchChain = vi.fn().mockImplementation(() => {
        ethereumProvider.chainId.value = newChainId;
        return true;
      });
      ethereumProvider.getChainId = vi.fn().mockResolvedValue(newChainId);

      const result = await ethereumProvider.switchChainSafely(chain);

      expect(result).toBe(true);
    });

    it('returns false if an exception was raised by the action', async () => {
      const currentChainId = 1;
      const newChainId = 2;
      const chain = generateChain({ identifier: newChainId });

      const ethereumProvider = new TestEthereumProvider();
      ethereumProvider.chainId.value = currentChainId;
      ethereumProvider.switchChain = vi.fn().mockImplementation(() => {
        throw new Error('error');
      });

      const result = await ethereumProvider.switchChainSafely(chain);

      expect(result).toBe(false);
    });
  });

  describe('addToken()', () => {
    it('initiates a wallet provider token `import` action', () => {
      const token = generateToken();

      const eipProvider = new MockedEip1193Provider();
      eipProvider.request = vi.fn().mockReturnValue(true);

      const ethereumProvider = new TestEthereumProvider(eipProvider);
      ethereumProvider.addToken(token);

      expect(eipProvider.request).toHaveBeenNthCalledWith(1, {
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
        },
      });
    });

    it('returns the status of the `import` action', async () => {
      const status = true;
      const token = generateToken();

      const eipProvider = new MockedEip1193Provider();
      eipProvider.request = vi.fn().mockReturnValue(status);

      const ethereumProvider = new TestEthereumProvider(eipProvider);
      const result = await ethereumProvider.addToken(token);

      expect(result).toBe(status);
    });

    it('returns false if an exception was raised by the `import` action', async () => {
      const token = generateToken();

      const eipProvider = new MockedEip1193Provider();
      eipProvider.request = vi.fn().mockImplementation(() => {
        throw new Error('error');
      });

      const ethereumProvider = new TestEthereumProvider(eipProvider);
      const result = await ethereumProvider.addToken(token);

      expect(result).toBe(false);
    });
  });
});
