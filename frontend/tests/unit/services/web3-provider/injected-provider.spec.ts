import * as providers from '@ethersproject/providers';
import * as ethersUtils from 'ethers/lib/utils';

import { createInjectedProvider, InjectedProvider } from '@/services/web3-provider';
import * as utils from '@/services/web3-provider/util-export';
import { generateChain, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEip1193Provider, MockedWeb3Provider } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/web3-provider/util-export');
vi.mock('@ethersproject/providers');
vi.mock('ethers/lib/utils');

function mockWeb3Provider() {
  const web3Provider = new MockedWeb3Provider();

  Object.defineProperty(providers, 'Web3Provider', {
    value: vi.fn().mockImplementation(() => web3Provider),
  });

  return web3Provider;
}

describe('injected-provider', () => {
  beforeEach(() => {
    mockWeb3Provider();
  });

  describe('createInjectedProvider()', () => {
    it('creates & initializes an injected wallet provider', async () => {
      Object.defineProperty(utils, 'detectEthereumProvider', {
        value: vi.fn().mockResolvedValue(new MockedEip1193Provider()),
      });

      const chain = generateChain({ identifier: 2 });
      const signerAddress = getRandomEthereumAddress();
      const signer = 'fake-signer';

      const web3Provider = mockWeb3Provider();
      web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
      web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);
      web3Provider.getSigner = vi.fn().mockReturnValue(signer);

      const injectedProvider = await createInjectedProvider();

      expect(injectedProvider?.chainId.value).toBe(chain.identifier);
      expect(injectedProvider?.signer.value).toBe(signer);
      expect(injectedProvider?.signerAddress.value).toBe(signerAddress);
    });

    describe('when no injected provider is available', () => {
      it('returns undefined', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue(null),
        });

        const injectedProvider = await createInjectedProvider();

        expect(injectedProvider).toBeUndefined();
      });
    });

    describe('when MetaMask injected provider is detected', () => {
      it('returns undefined', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue(new MockedEip1193Provider({ isMetaMask: true })),
        });

        const injectedProvider = await createInjectedProvider();

        expect(injectedProvider).toBeUndefined();
      });
    });
  });

  describe('InjectedProvider', () => {
    describe('requestSigner()', () => {
      beforeEach(() => {
        Object.defineProperty(ethersUtils, 'getAddress', {
          value: vi.fn().mockImplementation((value) => value),
        });
      });

      it('connects to the first accessible connected wallet address', async () => {
        const eipProvider = new MockedEip1193Provider();

        const signerAddress = getRandomEthereumAddress();
        const signer = 'fake-signer';

        const web3Provider = mockWeb3Provider();
        web3Provider.send = vi.fn().mockReturnValue([signerAddress]);
        web3Provider.getSigner = vi.fn().mockReturnValue(signer);

        const injectedProvider = new InjectedProvider(eipProvider);
        await injectedProvider.requestSigner();

        expect(injectedProvider?.signer.value).toBe(signer);
        expect(injectedProvider?.signerAddress.value).toBe(signerAddress);
      });

      it('disconnects the currently connected wallet address if an exception was thrown', async () => {
        const eipProvider = new MockedEip1193Provider();

        const web3Provider = mockWeb3Provider();
        web3Provider.send = vi.fn().mockImplementation(() => {
          throw new Error('error');
        });

        const injectedProvider = new InjectedProvider(eipProvider);
        await injectedProvider.requestSigner();

        expect(injectedProvider.signer.value).toBeUndefined();
        expect(injectedProvider.signerAddress.value).toBeUndefined();
      });
    });
  });
});
