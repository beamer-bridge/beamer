import { RequestInformation } from '@/actions/transfers/request-information';
import {
  generateRequestInformationData,
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('RequestInformation', () => {
  describe('setTimestamp()', () => {
    it('is possible when timestamp is not already defined', () => {
      const data = generateRequestInformationData({ timestamp: undefined });
      const information = new RequestInformation(data);
      const timestamp = getRandomNumber();
      information.setTimestamp(timestamp);

      expect(information.timestamp).toEqual(timestamp);
    });

    it('fails if timestamp is alrady defined', () => {
      const timestamp = getRandomNumber();
      const data = generateRequestInformationData({ timestamp });
      const information = new RequestInformation(data);

      return expect(() => information.setTimestamp(timestamp)).toThrow(
        'Attempt to overwrite already set timestamp of a request!',
      );
    });
  });

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

  describe('setBlockNumberOnTargetChain()', () => {
    it('is possible when block number on target chain is not already defined', () => {
      const data = generateRequestInformationData({ blockNumberOnTargetChain: undefined });
      const information = new RequestInformation(data);
      const blockNumberOnTargetChain = getRandomNumber();
      information.setBlockNumberOnTargetChain(blockNumberOnTargetChain);

      expect(information.blockNumberOnTargetChain).toEqual(blockNumberOnTargetChain);
    });

    it('fails if block number on target chain is alrady defined', () => {
      const blockNumberOnTargetChain = getRandomNumber();
      const data = generateRequestInformationData({ blockNumberOnTargetChain });
      const information = new RequestInformation(data);

      return expect(() =>
        information.setBlockNumberOnTargetChain(blockNumberOnTargetChain),
      ).toThrow(
        'Attempt to overwrite already existing block number on target chain of a request!',
      );
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist token amount', () => {
      const transactionHash = getRandomTransactionHash();
      const internalTransactionHash = getRandomTransactionHash();
      const requestAccount = getRandomEthereumAddress();
      const blockNumberOnTargetChain = getRandomNumber();
      const identifier = getRandomString();
      const data = {
        transactionHash,
        requestAccount,
        blockNumberOnTargetChain,
        identifier,
        internalTransactionHash,
      };
      const information = new RequestInformation(data);

      const encodedData = information.encode();

      expect(encodedData.transactionHash).toMatchObject(transactionHash);
      expect(encodedData.internalTransactionHash).toMatchObject(internalTransactionHash);
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
