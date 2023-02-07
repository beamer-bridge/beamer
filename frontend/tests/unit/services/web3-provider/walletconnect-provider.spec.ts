import * as providers from '@ethersproject/providers';

import { createWalletConnectProvider } from '@/services/web3-provider';
import * as utils from '@/services/web3-provider/util-export';
import { generateChain, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedWalletConnectConnector, MockedWeb3Provider } from '~/utils/mocks/ethereum-provider';

vi.mock('ethers/lib/utils');
vi.mock('@ethersproject/providers');
vi.mock('@/services/web3-provider/util-export');

function mockWeb3Provider(): MockedWeb3Provider {
  const web3Provider = new MockedWeb3Provider();

  Object.defineProperty(providers, 'Web3Provider', {
    value: vi.fn().mockImplementation(() => web3Provider),
  });

  return web3Provider;
}

function mockWalletConnectConnector(): MockedWalletConnectConnector {
  const walletConnect = new MockedWalletConnectConnector();
  walletConnect.init = vi.fn().mockImplementation(() => walletConnect);

  Object.defineProperty(utils, 'WalletConnect', {
    value: walletConnect,
  });

  return walletConnect;
}

describe('walletconnect-provider', () => {
  beforeEach(() => {
    mockWeb3Provider();
    mockWalletConnectConnector();
  });

  describe('createWalletConnectProvider()', () => {
    it('returns an instance of the wallet connect provider once connected', async () => {
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

      const connector = mockWalletConnectConnector();
      connector.enable = vi.fn().mockImplementation(() => (connector.connected = true));

      const provider = await createWalletConnectProvider(rpcList);

      expect(connector.enable).toHaveBeenCalledOnce();
      expect(provider).not.toBeUndefined();
    });

    it('returns undefined when connection failed', async () => {
      const chain = generateChain({ identifier: 2 });
      const rpcList = {
        [chain.identifier]: chain.rpcUrl,
      };

      const connector = mockWalletConnectConnector();
      connector.enable = vi.fn().mockImplementation(() => (connector.connected = false));

      const provider = await createWalletConnectProvider(rpcList);

      expect(provider).toBeUndefined();
    });
  });
});
