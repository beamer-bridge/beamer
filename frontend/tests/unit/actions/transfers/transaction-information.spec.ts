import { TransactionInformation } from '@/actions/transfers';
import {
  generateTransactionInformationData,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('TransactionInformation', () => {
  describe('setTransactionHash()', () => {
    it('is possible when transaction hash is not already defined', () => {
      const data = generateTransactionInformationData({ transactionHash: undefined });
      const information = new TransactionInformation(data);
      const transactionHash = getRandomTransactionHash();
      information.setTransactionHash(transactionHash);

      expect(information.transactionHash).toEqual(transactionHash);
    });

    it('fails if transaction hash is alrady defined', () => {
      const transactionHash = getRandomTransactionHash();
      const data = generateTransactionInformationData({ transactionHash });
      const information = new TransactionInformation(data);

      return expect(() => information.setTransactionHash(transactionHash)).toThrow(
        'Attempt to overwrite already existing transaction hash!',
      );
    });
  });
  describe('setInternalTransactionHash()', () => {
    it('is possible when transaction hash is not already defined', () => {
      const data = generateTransactionInformationData({ internalTransactionHash: undefined });
      const information = new TransactionInformation(data);
      const transactionHash = getRandomTransactionHash();
      information.setInternalTransactionHash(transactionHash);

      expect(information.internalTransactionHash).toEqual(transactionHash);
    });

    it('fails if transaction hash is alrady defined', () => {
      const internalTransactionHash = getRandomTransactionHash();
      const data = generateTransactionInformationData({ internalTransactionHash });
      const information = new TransactionInformation(data);

      return expect(() => information.setInternalTransactionHash(internalTransactionHash)).toThrow(
        'Attempt to overwrite already existing internal transaction hash!',
      );
    });
  });
});
