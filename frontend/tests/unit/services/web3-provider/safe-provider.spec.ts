import * as providers from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import { createSafeProvider, SafeProvider } from '@/services/web3-provider';
import * as utils from '@/services/web3-provider/util-export';
import { generateChain, getRandomEthereumAddress } from '~/utils/data_generators';
import {
  MockedSafeAppProvider,
  MockedSafeAppsSDK,
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

function mockSafeAppsSDK(sdkMock?: MockedSafeAppsSDK) {
  Object.defineProperty(utils, 'SafeAppsSDK', {
    value: vi.fn().mockImplementation(() => sdkMock || new MockedSafeAppsSDK()),
  });
}

function mockSafeProvider() {
  mockSafeAppsSDK();
  Object.defineProperty(utils, 'SafeAppProvider', {
    value: vi.fn().mockImplementation(() => new MockedSafeAppProvider()),
  });
}

describe('safe-provider', () => {
  beforeEach(() => {
    mockWeb3Provider();
    mockSafeProvider();
    vi.useFakeTimers();
  });

  describe('createSafeProvider()', () => {
    it('returns an instance of the safe provider', async () => {
      const chain = generateChain({ identifier: 2 });
      const signerAddress = getRandomEthereumAddress();
      const signer = 'fake-signer';

      const web3Provider = mockWeb3Provider();
      web3Provider.getNetwork = vi.fn().mockReturnValue({ chainId: chain.identifier });
      web3Provider.listAccounts = vi.fn().mockReturnValue([signerAddress]);
      web3Provider.getSigner = vi.fn().mockReturnValue(signer);
      mockSafeProvider();

      const provider = await createSafeProvider();

      expect(provider).toBeInstanceOf(SafeProvider);
      expect(provider?.chainId.value).toBe(chain.identifier);
      expect(provider?.signer.value).toBe(signer);
      expect(provider?.signerAddress.value).toBe(signerAddress);
    });

    it('returns undefined when not connected to a safe', async () => {
      const sdk = new MockedSafeAppsSDK();
      sdk.safe.getInfo = new Promise(vi.fn());

      let provider = null;
      createSafeProvider().then((returnedProvider) => (provider = returnedProvider));

      vi.runAllTimers();
      await flushPromises();

      expect(provider).toBeUndefined();
    });
  });
});
