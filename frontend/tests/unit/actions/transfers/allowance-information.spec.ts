import { AllowanceInformation } from '@/actions/transfers';
import {
  generateAllowanceInformationData,
  getRandomTransactionHash,
} from '~/utils/data_generators';

describe('AllowanceInformation', () => {
  describe('encode()', () => {
    it('serializes all data', () => {
      const transactionHash = getRandomTransactionHash();
      const internalTransactionHash = getRandomTransactionHash();

      const information = new AllowanceInformation({
        transactionHash,
        internalTransactionHash,
      });

      const encodedData = information.encode();

      expect(encodedData.transactionHash).toBe(transactionHash);
      expect(encodedData.internalTransactionHash).toBe(internalTransactionHash);
    });

    it('can be used to re-instantiate a RequestFulfillment object', () => {
      const data = generateAllowanceInformationData();
      const allowanceInfo = new AllowanceInformation(data);

      const encodedData = allowanceInfo.encode();
      const newAllowanceInfo = new AllowanceInformation(encodedData);
      const newEncodedData = newAllowanceInfo.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
