import * as providers from '@ethersproject/providers';

import { createCoinbaseProvider } from '@/services/web3-provider/coinbase-provider';
import * as utils from '@/services/web3-provider/util-export';
import { generateChain, getRandomEthereumAddress } from '~/utils/data_generators';
import {
  MockedCoinbaseConnector,
  MockedCoinbaseWalletSDK,
  MockedWeb3Provider,
} from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');
vi.mock('ethers/lib/utils');
vi.mock('@/services/web3-provider/util-export');

function mockWeb3Provider(): MockedWeb3Provider {
  const web3Provider = new MockedWeb3Provider();

  Object.defineProperty(providers, 'Web3Provider', {
    value: vi.fn().mockImplementation(() => web3Provider),
  });

  return web3Provider;
}

function mockCoinbaseConnector(): MockedCoinbaseConnector {
  const coinbaseProvider = new MockedCoinbaseConnector();
  const coinbaseSDK = new MockedCoinbaseWalletSDK();
  coinbaseSDK.makeWeb3Provider = vi.fn().mockImplementation(() => coinbaseProvider);

  Object.defineProperty(utils, 'CoinbaseWalletSDK', {
    value: vi.fn().mockImplementation(() => coinbaseSDK),
  });

  return coinbaseProvider;
}

describe('coinbase-provider', () => {
  beforeEach(() => {
    mockWeb3Provider();
    mockCoinbaseConnector();
  });

  describe('createCoinbaseProvider()', () => {
    it('returns an instance of the coinbase provider once connected', async () => {
      const chain = generateChain({ identifier: 2 });
      const signerAddress = getRandomEthereumAddress();
      const signer = 'fake-signer';
      const rpcList = {
        [chain.identifier]: chain.rpcUrl,
      };

      const web3Provider = mockWeb3Provider();
      web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
      web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);
      web3Provider.getSigner = vi.fn().mockReturnValue(signer);

      const connector = mockCoinbaseConnector();
      connector.enable = vi.fn().mockImplementation(() => (connector.connected = true));

      const provider = await createCoinbaseProvider(rpcList);

      expect(connector.enable).toHaveBeenCalledOnce();
      expect(provider).not.toBeUndefined();
      expect(provider?.chainId.value).toBe(chain.identifier);
      expect(provider?.signer.value).toBe(signer);
      expect(provider?.signerAddress.value).toBe(signerAddress);
    });

    it('returns undefined when connection failed', async () => {
      const chain = generateChain({ identifier: 2 });
      const rpcList = {
        [chain.identifier]: chain.rpcUrl,
      };

      const connector = mockCoinbaseConnector();
      connector.enable = vi.fn().mockImplementation(() => (connector.connected = false));

      const provider = await createCoinbaseProvider(rpcList);

      expect(provider).toBeUndefined();
    });
  });
});
