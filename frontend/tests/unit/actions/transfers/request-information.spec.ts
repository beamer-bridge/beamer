import { RequestInformation } from '@/actions/transfers/request-information';
import {
  generateRequestInformationData,
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('RequestInformation', () => {
  describe('setIdentifier()', () => {
    it('is possible when identifier is not already defined', () => {
      const data = generateRequestInformationData({ identifier: undefined });
      const information = new RequestInformation(data);
      const identifier = getRandomString();
      information.setIdentifier(identifier);

      expect(information.identifier).toEqual(identifier);
    });

    it('fails if identifier is alrady defined', () => {
      const identifier = getRandomString();
      const data = generateRequestInformationData({ identifier });
      const information = new RequestInformation(data);

      return expect(() => information.setIdentifier(identifier)).toThrow(
        'Attempt to overwrite already existing identifier of a request!',
      );
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist token amount', () => {
      const transactionHash = getRandomTransactionHash();
      const requestAccount = getRandomEthereumAddress();
      const blockNumberOnTargetChain = getRandomNumber();
      const identifier = getRandomString();
      const data = { transactionHash, requestAccount, blockNumberOnTargetChain, identifier };
      const information = new RequestInformation(data);

      const encodedData = information.encode();

      expect(encodedData.transactionHash).toMatchObject(transactionHash);
      expect(encodedData.requestAccount).toMatchObject(requestAccount);
      expect(encodedData.blockNumberOnTargetChain).toMatchObject(blockNumberOnTargetChain);
      expect(encodedData.identifier).toEqual(identifier);
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
