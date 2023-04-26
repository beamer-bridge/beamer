import { RequestFulfillment } from '@/actions/transfers/request-fulfillment';
import { generateRequestFulfillmentData, getRandomNumber } from '~/utils/data_generators';

describe('RequestFulfillment', () => {
  describe('encode()', () => {
    it('serializes all data', () => {
      const timestamp = getRandomNumber();
      const data = { timestamp };
      const information = new RequestFulfillment(data);

      const encodedData = information.encode();

      expect(encodedData.timestamp).toMatchObject(timestamp);
    });

    it('can be used to re-instantiate a RequestFulfillment object', () => {
      const data = generateRequestFulfillmentData();
      const fulfillment = new RequestFulfillment(data);

      const encodedData = fulfillment.encode();
      const newFulfillment = new RequestFulfillment(encodedData);
      const newEncodedData = newFulfillment.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
