import { TokenMetadata } from 'config/tokens/token';
import * as utils from 'config/utils';

import { generateTokenMetadata, getRandomEthereumAddress } from '~/utils/data_generators';

describe('TokenMetadata', () => {
  describe('isChainSupported()', () => {
    it('checks if chain is supported for the token', () => {
      const mockTokenMeta = generateTokenMetadata({
        addresses: { '1': getRandomEthereumAddress() },
      });

      expect(mockTokenMeta.isChainSupported('2')).toBe(false);
      expect(mockTokenMeta.isChainSupported('1')).toBe(true);
    });
  });
  describe('formatByChainId()', () => {
    describe('when chain is supported', () => {
      it('returns a representation of Token for the corresponding chain', () => {
        const contractAddress = getRandomEthereumAddress();
        const mockTokenMeta = generateTokenMetadata({
          addresses: { '1': contractAddress },
        });

        const token = mockTokenMeta.formatByChainId('1');
        expect(token.address).toBe(contractAddress);
      });
    });
    describe('when chain is not supported', () => {
      it('returns a representation of Token with address being undefined', () => {
        const contractAddress = getRandomEthereumAddress();
        const mockTokenMeta = generateTokenMetadata({
          addresses: { '1': contractAddress },
        });

        const token = mockTokenMeta.formatByChainId('2');
        expect(token.address).toBe(undefined);
      });
    });
  });
  describe('addAddresses()', () => {
    it('adds bulk token addresses for chains', () => {
      const mockTokenMeta = generateTokenMetadata({
        addresses: { '1': getRandomEthereumAddress() },
      });
      mockTokenMeta.addAddresses({
        '2': getRandomEthereumAddress(),
        '3': getRandomEthereumAddress(),
      });

      expect(Object.keys(mockTokenMeta.addresses)).toEqual(['1', '2', '3']);
    });
  });
  describe('addAddress()', () => {
    it('adds a token address for a specific chain', () => {
      const contractAddress1 = getRandomEthereumAddress();
      const contractAddress2 = getRandomEthereumAddress();
      const addresses = {
        '1': contractAddress1,
      };
      const mockTokenMeta = generateTokenMetadata({ addresses });
      mockTokenMeta.addAddress('2', contractAddress2);

      expect(mockTokenMeta.addresses).toEqual({
        '1': contractAddress1,
        '2': contractAddress2,
      });
    });
  });

  describe('readFromFile()', () => {
    it("fails to read if file doesn't exist", () => {
      expect(() => TokenMetadata.readFromFile('test.json')).toThrow();
    });
    it('instantiates an object from a local file', () => {
      const mockTokenMeta = generateTokenMetadata();
      Object.defineProperty(utils, 'readFileJsonContent', {
        value: vi.fn().mockReturnValue(mockTokenMeta),
      });

      const tokenMeta = TokenMetadata.readFromFile('test.json');
      expect(Object.keys(tokenMeta)).toEqual(Object.keys(mockTokenMeta));
      expect(Object.values(tokenMeta)).toEqual(Object.values(mockTokenMeta));
    });
  });

  describe('flushTo()', () => {
    it('flushes the current state to a local directory', () => {
      const mockTokenMeta = generateTokenMetadata();
      Object.defineProperty(utils, 'writeToFile', {
        value: vi.fn(),
      });

      mockTokenMeta.flushTo('testDir');
      expect(utils.writeToFile).toHaveBeenCalledWith(
        `testDir/${mockTokenMeta.symbol}.json`,
        JSON.stringify(mockTokenMeta),
      );
    });
  });
});
