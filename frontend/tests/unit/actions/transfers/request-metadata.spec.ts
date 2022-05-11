import { RequestMetadata } from '@/actions/transfers/request-metadata';
import { UInt256 } from '@/types/uint-256';
import {
  generateRequestMetadataData,
  generateUInt256Data,
  getRandomEthereumAddress,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('RequestMetadata', () => {
  describe('setIdentifier()', () => {
    it('is possible when identifier is not already defined', () => {
      const data = generateRequestMetadataData({ identifier: undefined });
      const metadata = new RequestMetadata(data);

      metadata.setIdentifier(new UInt256('1'));

      expect(metadata.identifier).toMatchObject(new UInt256('1'));
    });

    it('fails if identifier is alrady defined', () => {
      const data = generateRequestMetadataData({ identifier: '1' });
      const metadata = new RequestMetadata(data);

      return expect(() => metadata.setIdentifier(new UInt256('2'))).toThrow(
        'Attempt to overwrite already existing identifier of a request!',
      );
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist token amount', () => {
      const transactionHash = getRandomTransactionHash();
      const requestAccount = getRandomEthereumAddress();
      const identifier = generateUInt256Data();
      const data = { transactionHash, requestAccount, identifier };
      const metadata = new RequestMetadata(data);

      const encodedData = metadata.encode();

      expect(encodedData.transactionHash).toMatchObject(transactionHash);
      expect(encodedData.requestAccount).toMatchObject(requestAccount);
      expect(encodedData.identifier).toMatchObject(identifier);
    });

    it('can be used to re-instantiate token amount again', () => {
      const data = generateRequestMetadataData();
      const metadata = new RequestMetadata(data);

      const encodedData = metadata.encode();
      const newRequestMetadata = new RequestMetadata(encodedData);
      const newEncodedData = newRequestMetadata.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
