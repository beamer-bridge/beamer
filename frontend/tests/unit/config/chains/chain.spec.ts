import { ChainMetadata } from 'config/chains/chain';
import * as utils from 'config/utils';

import {
  generateChainMetadata,
  generateTokenMetadata,
  getRandomEthereumAddress,
} from '~/utils/data_generators';

describe('ChainMetadata', () => {
  describe('formatUsingTokenMetas()', () => {
    describe('when there are no tokens matching the chain id', () => {
      it('returns a representation of a chain with empty token list', () => {
        const tokenChainId = 1;
        const chainId = 2;
        const tokenMetas = [
          generateTokenMetadata({
            symbol: 'TKN1',
            addresses: { [tokenChainId]: getRandomEthereumAddress() },
          }),
          generateTokenMetadata({
            symbol: 'TKN2',
            addresses: { [tokenChainId]: getRandomEthereumAddress() },
          }),
        ];

        const chainMeta = generateChainMetadata({
          tokenSymbols: ['TKN1', 'TKN2'],
          identifier: chainId,
        });

        const chain = chainMeta.formatUsingTokenMetas(tokenMetas);

        expect(chain.tokens).toEqual([]);
      });
    });
    describe('when there are tokens matching the chain id', () => {
      it('returns a representation of a chain with supported tokens together with their metadata', () => {
        const chainId = 1;
        const tokenMetas = [
          generateTokenMetadata({
            symbol: 'TKN1',
            addresses: { [chainId]: getRandomEthereumAddress() },
          }),
          generateTokenMetadata({
            symbol: 'TKN2',
            addresses: { [chainId]: getRandomEthereumAddress() },
          }),
        ];

        const chainMeta = generateChainMetadata({
          tokenSymbols: ['TKN1', 'TKN2'],
          identifier: chainId,
        });

        const chain = chainMeta.formatUsingTokenMetas(tokenMetas);

        expect(chain.tokens?.map((token) => token.symbol)).toEqual(['TKN1', 'TKN2']);
      });
    });
  });

  describe('readFromFile()', () => {
    it("fails to read if file doesn't exist", () => {
      expect(() => ChainMetadata.readFromFile('test.json')).toThrow();
    });
    it('instantiates an object from a local file', () => {
      const mockChainMeta = generateChainMetadata();
      Object.defineProperty(utils, 'readFileJsonContent', {
        value: vi.fn().mockReturnValue(mockChainMeta),
      });

      const chainMeta = ChainMetadata.readFromFile('test.json');
      expect(Object.keys(chainMeta)).toEqual(Object.keys(mockChainMeta));
      expect(Object.values(chainMeta)).toEqual(Object.values(mockChainMeta));
    });
  });
});
