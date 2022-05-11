import { UInt256 } from '@/types/uint-256';
import { generateUInt256Data } from '~/utils/data_generators';

describe('UInt256', () => {
  describe('parse()', () => {
    it('correctly parses integer number according to decimals', () => {
      const number = UInt256.parse('2', 4);

      expect(number.asString).toBe('20000');
    });

    it('correctly parses decimal values', () => {
      const number = UInt256.parse('1.2345', 5);

      expect(number.asString).toBe('123450');
    });

    it('sets decimals to zero per default', () => {
      const number = UInt256.parse('1', 0);

      expect(number.asString).toBe('1');
    });

    it('can parse negative numbers', () => {
      const number = UInt256.parse('-1');

      expect(number.asString).toBe('-1');
    });

    it('can parse numbers larger then the maximum JavaScript integer', () => {
      UInt256.parse(Number.MAX_SAFE_INTEGER.toString() + '00', 0);
    });
  });

  describe('format()', () => {
    it('converts number to decimals representation bases on decimals', () => {
      const number = new UInt256('123');

      expect(number.format(1)).toBe('12.3');
      expect(number.format(2)).toBe('1.23');
      expect(number.format(3)).toBe('0.123');
    });
  });

  describe('encode()', () => {
    it('serializes data to persist number', () => {
      const data = generateUInt256Data('123');
      const number = new UInt256(data);

      const encodedData = number.encode();

      expect(encodedData).toBe('123');
    });

    it('can be used to re-instantiate number again', () => {
      const data = generateUInt256Data();
      const number = new UInt256(data);

      const encodedData = number.encode();
      const newNumber = new UInt256(encodedData);
      const newEncodedData = newNumber.encode();

      expect(encodedData).toMatch(newEncodedData);
    });
  });
});
