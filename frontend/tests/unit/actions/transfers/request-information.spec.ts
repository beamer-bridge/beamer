import { RequestInformation } from '@/actions/transfers/request-information';
import { UInt256 } from '@/types/uint-256';
import {
  generateRequestInformationData,
  generateUInt256Data,
  getRandomEthereumAddress,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('RequestInformation', () => {
  describe('setIdentifier()', () => {
    it('is possible when identifier is not already defined', () => {
      const data = generateRequestInformationData({ identifier: undefined });
      const information = new RequestInformation(data);

      information.setIdentifier(new UInt256('1'));

      expect(information.identifier).toMatchObject(new UInt256('1'));
    });

    it('fails if identifier is alrady defined', () => {
      const data = generateRequestInformationData({ identifier: '1' });
      const information = new RequestInformation(data);

      return expect(() => information.setIdentifier(new UInt256('2'))).toThrow(
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
      const information = new RequestInformation(data);

      const encodedData = information.encode();

      expect(encodedData.transactionHash).toMatchObject(transactionHash);
      expect(encodedData.requestAccount).toMatchObject(requestAccount);
      expect(encodedData.identifier).toMatchObject(identifier);
    });

    it('can be used to re-instantiate token amount again', () => {
      const data = generateRequestInformationData();
      const information = new RequestInformation(data);

      const encodedData = information.encode();
      const newInformation = new RequestInformation(encodedData);
      const newEncodedData = newInformation.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
