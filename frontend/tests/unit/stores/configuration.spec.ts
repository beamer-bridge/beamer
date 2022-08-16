import { createPinia, setActivePinia } from 'pinia';

import { useConfiguration } from '@/stores/configuration';
import { generateChainWithTokens, generateToken } from '~/utils/data_generators';

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('setChainConfiguration()', () => {
    it('can add a new chain configuration', async () => {
      const configuration = useConfiguration();
      const chainConfiguration = generateChainWithTokens();

      expect(configuration.chains['5']).toBeUndefined();

      configuration.setChainConfiguration('5', chainConfiguration);

      expect(configuration.chains['5']).toMatchObject(chainConfiguration);
    });

    it('can update existing chain configuration', async () => {
      const configuration = useConfiguration();
      const oldChainConfiguration = generateChainWithTokens({ name: 'old-name' });
      const newChainConfiguration = { ...oldChainConfiguration, name: 'new-name' };
      configuration.$state = { chains: { ['5']: oldChainConfiguration } };

      expect(configuration.chains['5']).toMatchObject(oldChainConfiguration);

      configuration.setChainConfiguration('5', newChainConfiguration);

      expect(configuration.chains['5']).toMatchObject(newChainConfiguration);
    });
  });
  describe('getTokenForChain getter', () => {
    it('returns a specific token for specific chain', () => {
      const configuration = useConfiguration();
      const tokenSymbol = 'TST';
      const chainId = 5;
      const tokens = [generateToken({ symbol: tokenSymbol })];
      const chain = generateChainWithTokens({ identifier: chainId, tokens });
      configuration.$state = { chains: { [chainId]: chain } };
      const token = configuration.getTokenForChain(5, 'TST');
      expect(token).toEqual(tokens[0]);
    });
    it('returns undefined when token not found in configuration', () => {
      const configuration = useConfiguration();
      const tokenSymbol = 'TST';
      const chainId = 5;
      const tokens = [generateToken({ symbol: tokenSymbol })];
      const chain = generateChainWithTokens({ identifier: chainId, tokens });
      configuration.$state = { chains: { [chainId]: chain } };
      const token = configuration.getTokenForChain(5, 'TST2');
      expect(token).toBeUndefined();
    });
  });

  describe('getChain getter', () => {
    it('returns specific chain', () => {
      const configuration = useConfiguration();
      const chainId = 5;
      const chain = generateChainWithTokens({ identifier: chainId });
      configuration.$state = { chains: { [chainId]: chain } };
      const chainResponse = configuration.getChain(5);
      expect(chainResponse).toEqual(chain);
    });
    it('returns undefined when chain not found in configuration', () => {
      const configuration = useConfiguration();
      const chainId = 5;
      const chain = generateChainWithTokens({ identifier: chainId });
      configuration.$state = { chains: { [chainId]: chain } };
      const chainResponse = configuration.getChain(10);
      expect(chainResponse).toBeUndefined();
    });
  });

  describe('isSupportedChain getter', () => {
    it('returns false if unsupported chain', () => {
      const configuration = useConfiguration();
      const chainConfiguration = generateChainWithTokens();
      const unSupportedChainId = 10;
      configuration.$state = { chains: { ['5']: chainConfiguration } };
      expect(configuration.isSupportedChain(unSupportedChainId)).toBe(false);
    });

    it('returns true if chain is supported', () => {
      const configuration = useConfiguration();
      const chainConfiguration = generateChainWithTokens();
      const supportedChainId = 5;
      configuration.$state = { chains: { [`${supportedChainId}`]: chainConfiguration } };
      expect(configuration.isSupportedChain(supportedChainId)).toBe(true);
    });
  });

  describe('rpcUrls getter', () => {
    it('returns empty object if no configuration has been loaded', () => {
      const configuration = useConfiguration();
      expect(configuration.rpcUrls).toEqual({});
    });

    it('returns all rpc urls for all chains in configuration', () => {
      const configuration = useConfiguration();
      const chain1Configuration = generateChainWithTokens();
      const chain2Configuration = generateChainWithTokens();
      configuration.$state = {
        chains: {
          ['1']: chain1Configuration,
          ['2']: chain2Configuration,
        },
      };
      expect(configuration.rpcUrls).toEqual({
        1: chain1Configuration.rpcUrl,
        2: chain2Configuration.rpcUrl,
      });
    });
  });
});
