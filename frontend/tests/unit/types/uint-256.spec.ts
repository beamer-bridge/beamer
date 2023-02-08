import { EXCEPTIONS, UInt256 } from '@/types/uint-256';
import { generateUInt256Data } from '~/utils/data_generators';

function createUInt256Pair(numberOne: string, numberTwo: string) {
  return [
    new UInt256(generateUInt256Data(numberOne)),
    new UInt256(generateUInt256Data(numberTwo)),
  ];
}
describe('UInt256', () => {
  it('cannot be instantiated for a negative number', () => {
    expect(() => new UInt256('-50')).toThrow(EXCEPTIONS.CONSTRUCT_NEGATIVE_VALUE);
  });

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

    it('can parse numbers larger then the maximum JavaScript integer', () => {
      UInt256.parse(Number.MAX_SAFE_INTEGER.toString() + '00', 0);
    });
  });

  describe('max()', () => {
    it('correctly returns the maximum UInt256', () => {
      const max = UInt256.max();
      expect(max.asString).toBe(
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      );
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

      expect(encodedData).toEqual(newEncodedData);
    });
  });

  describe('add()', () => {
    it('returns sum of two numbers', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '50');
      expect(numberOne.add(numberTwo).asString).toBe('150');
    });
  });

  describe('subtract()', () => {
    it('returns the difference between two numbers', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '50');
      expect(numberOne.subtract(numberTwo).asString).toBe('50');
    });
  });

  describe('multiply()', () => {
    it('returns the multiplication result of the two numbers', () => {
      const [numberOne, numberTwo] = createUInt256Pair('4', '4');
      expect(numberOne.multiply(numberTwo).asString).toBe('16');
    });
  });

  describe('divide()', () => {
    it('returns the result of the divison between the two numbers', () => {
      const [numberOne, numberTwo] = createUInt256Pair('4', '4');
      expect(numberOne.divide(numberTwo).asString).toBe('1');
    });
  });

  describe('isZero()', () => {
    it('returns true if number instance is equal to zero', () => {
      const zeroNumber = new UInt256(generateUInt256Data('0'));
      expect(zeroNumber.isZero()).toBe(true);
    });
    it('returns false if number instance is not equal to zero', () => {
      const nonZeroNumber = new UInt256(generateUInt256Data('100'));
      expect(nonZeroNumber.isZero()).toBe(false);
    });
  });

  describe('lte()', () => {
    it('returns true if number instance is less than provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('99', '100');
      expect(numberOne.lte(numberTwo)).toBe(true);
    });
    it('returns false if number instance is greater than provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '99');
      expect(numberOne.lte(numberTwo)).toBe(false);
    });
    it('returns true if number instance is equal to provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '100');
      expect(numberOne.lte(numberTwo)).toBe(true);
    });
  });

  describe('gte()', () => {
    it('returns true if number instance is greater than provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '99');
      expect(numberOne.gte(numberTwo)).toBe(true);
    });
    it('returns false if number instance is less than provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('99', '100');
      expect(numberOne.gte(numberTwo)).toBe(false);
    });
    it('returns true if number instance is equal to provided number', () => {
      const [numberOne, numberTwo] = createUInt256Pair('100', '100');
      expect(numberOne.gte(numberTwo)).toBe(true);
    });
  });
});
