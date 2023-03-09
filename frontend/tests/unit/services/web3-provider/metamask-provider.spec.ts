import * as providers from '@ethersproject/providers';
import * as ethersUtils from 'ethers/lib/utils';

import {
  createMetaMaskProvider,
  MetaMaskProvider,
  onboardMetaMask,
} from '@/services/web3-provider';
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

describe('metamask-provider', () => {
  beforeEach(() => {
    mockWeb3Provider();
  });

  describe('createMetaMaskProvider()', () => {
    describe('when multiple injected providers are available in the browser', () => {
      it('returns undefined if no metamask provider was found', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue({
            providers: [
              new MockedEip1193Provider({ isMetaMask: false }),
              new MockedEip1193Provider({ isMetaMask: false }),
            ],
          }),
        });

        const metamaskProvider = await createMetaMaskProvider();

        expect(metamaskProvider).toBeUndefined();
      });
      it('returns the provider instance if metamask provider was found', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue({
            providers: [
              new MockedEip1193Provider({ isMetaMask: false }),
              new MockedEip1193Provider({ isMetaMask: true }),
            ],
          }),
        });

        const chain = generateChain({ identifier: 2 });
        const signerAddress = getRandomEthereumAddress();

        const web3Provider = mockWeb3Provider();
        web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
        web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);

        const metamaskProvider = await createMetaMaskProvider();

        expect(metamaskProvider).not.toBeUndefined();
      });
    });

    describe('when MetaMask is available', () => {
      it('creates & initializes a MetaMask wallet provider', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue(new MockedEip1193Provider({ isMetaMask: true })),
        });

        const chain = generateChain({ identifier: 2 });
        const signerAddress = getRandomEthereumAddress();
        const signer = 'fake-signer';

        const web3Provider = mockWeb3Provider();
        web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
        web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);
        web3Provider.getSigner = vi.fn().mockReturnValue(signer);

        const metamaskProvider = await createMetaMaskProvider();

        expect(metamaskProvider?.chainId.value).toBe(chain.identifier);
        expect(metamaskProvider?.signer.value).toBe(signer);
        expect(metamaskProvider?.signerAddress.value).toBe(signerAddress);
      });
    });
    describe('when MetaMask is not available', () => {
      it('returns undefined', async () => {
        Object.defineProperty(utils, 'detectEthereumProvider', {
          value: vi.fn().mockResolvedValue(new MockedEip1193Provider({ isMetaMask: false })),
        });

        const metamaskProvider = await createMetaMaskProvider();

        expect(metamaskProvider).toBeUndefined();
      });
    });
  });

  describe('onboardMetamask()', () => {
    it('starts the onboarding process when metamask is not available', async () => {
      const startOnboarding = vi.fn();
      Object.defineProperty(utils, 'MetaMaskOnboarding', {
        value: vi.fn().mockImplementation(() => ({
          startOnboarding,
        })),
      });

      await onboardMetaMask();

      expect(utils.MetaMaskOnboarding).toHaveBeenCalled();
      expect(startOnboarding).toHaveBeenCalled();
    });
  });

  describe('MetaMaskProvider', () => {
    describe('requestSigner()', () => {
      beforeEach(() => {
        Object.defineProperty(ethersUtils, 'getAddress', {
          value: vi.fn().mockImplementation((value) => value),
        });
      });

      it('connects to the first accessible connected wallet address', async () => {
        const eipProvider = new MockedEip1193Provider({ isMetaMask: true });

        const signerAddress = getRandomEthereumAddress();
        const signer = 'fake-signer';

        const web3Provider = mockWeb3Provider();
        web3Provider.send = vi.fn().mockReturnValue([signerAddress]);
        web3Provider.getSigner = vi.fn().mockReturnValue(signer);

        const metamaskProvider = new MetaMaskProvider(eipProvider);
        await metamaskProvider.requestSigner();

        expect(metamaskProvider?.signer.value).toBe(signer);
        expect(metamaskProvider?.signerAddress.value).toBe(signerAddress);
      });

      it('disconnects the currently connected wallet address if an exception was thrown', async () => {
        const eipProvider = new MockedEip1193Provider({ isMetaMask: true });

        const web3Provider = mockWeb3Provider();
        web3Provider.send = vi.fn().mockImplementation(() => {
          throw new Error('error');
        });

        const metamaskProvider = new MetaMaskProvider(eipProvider);
        await metamaskProvider.requestSigner();

        expect(metamaskProvider.signer.value).toBeUndefined();
        expect(metamaskProvider.signerAddress.value).toBeUndefined();
      });
    });

    describe('listenToEvents()', () => {
      it('attaches necessary event listeners for the wallet provider', () => {
        const eipProvider = new MockedEip1193Provider({ isMetaMask: true });
        const metamaskProvider = new MetaMaskProvider(eipProvider);

        metamaskProvider.listenToEvents();

        expect(eipProvider.on).toHaveBeenCalledWith('accountsChanged', expect.anything());
        expect(metamaskProvider['web3Provider'].on).toHaveBeenCalledWith(
          'network',
          expect.anything(),
        );
        // There is a bug with the disconnect event in MetaMask
        // See https://github.com/MetaMask/metamask-extension/issues/13375
        expect(eipProvider.on).not.toHaveBeenCalledWith('disconnect', expect.anything());
      });
    });
  });
});
