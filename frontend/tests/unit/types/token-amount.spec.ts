import { EthereumAmount, TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import {
  generateToken,
  generateTokenAmountData,
  generateUInt256Data,
} from '~/utils/data_generators';

describe('TokenAmount', () => {
  describe('new()', () => {
    it('allows easily to create instances with UInt256 value directly', () => {
      const uint = new UInt256(generateUInt256Data());
      const token = generateToken();
      const amount = TokenAmount.new(uint, token);

      expect(amount.uint256).toEqual(uint);
      expect(amount.token).toEqual(token);
    });
  });

  describe('parse()', () => {
    it('can parse integer based on given token decimals', () => {
      const token = generateToken({ decimals: 5 });
      const amount = TokenAmount.parse('12345', token);

      expect(amount.decimalAmount).toBe('12345.0');
    });

    it('has no final zero after period if decimals are zero', () => {
      const token = generateToken({ decimals: 0 });
      const amount = TokenAmount.parse('12345', token);

      expect(amount.decimalAmount).toBe('12345');
    });

    it('can parse floating number bases on givevn decimals', () => {
      const token = generateToken({ decimals: 18 });
      const amount = TokenAmount.parse('12.345', token);

      expect(amount.decimalAmount).toBe('12.345');
    });
  });

  describe('uint256', () => {
    it('allows to access amount as UInt256 for blockchain interactions', () => {
      const token = generateToken();
      const amount = new TokenAmount({ amount: '100', token });

      expect(amount.uint256).toBeDefined();
      expect(amount.uint256.asString).toBe('100');
    });
  });

  describe('format()', () => {
    it('per default formats 4 decimals and token symbol for values with 1 pre-decimal digit', () => {
      const token = generateToken({ decimals: 6, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '1234567', token });

      expect(amount.format()).toBe('1.2345 TTT');
    });

    it('can shorten number of visible decimal places', () => {
      const token = generateToken({ decimals: 4, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '12345', token });

      expect(amount.format({ decimalPlaces: 2 })).toBe('1.23 TTT');
    });

    it('can hide token symbol', () => {
      const token = generateToken({ decimals: 4, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '12345', token });

      expect(amount.format({ withSymbol: false })).toBe('1.2345');
    });

    it('per default shows 3 decimal places for values with 2 pre-decimal digits', () => {
      const token = generateToken({ decimals: 4, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '123456', token });

      expect(amount.format()).toBe('12.345 TTT');
    });

    it('per default shows 2 decimal places for values with more than 2 pre-decimal digits', () => {
      const token = generateToken({ decimals: 4, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '1234567', token });

      expect(amount.format()).toBe('123.45 TTT');
    });

    it('per default limits to 8 decimal places for values smaller 1', () => {
      const token = generateToken({ decimals: 18, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '123456789012345678', token });

      expect(amount.format()).toBe('0.12345678 TTT');
    });

    it('can show all decimal places for values smaller 1', () => {
      const token = generateToken({ decimals: 18, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '123456789012345678', token });

      expect(amount.format({ decimalPlaces: 18 })).toBe('0.123456789012345678 TTT');
    });

    it('shows a smaller sign if value is smaller than visible in defined decimals', () => {
      const token = generateToken({ decimals: 18, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '1', token });

      expect(amount.format()).toBe('<0.00000001 TTT');
    });
  });

  describe('formatFullValue()', () => {
    it('shows complete amount with all digits', () => {
      const token = generateToken({ decimals: 18, symbol: 'TTT' });
      const amount = new TokenAmount({ amount: '123456123456789012345678', token });

      expect(amount.formatFullValue()).toBe('123456.123456789012345678 TTT');
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist token amount', () => {
      const token = generateToken();
      const amount = generateUInt256Data();
      const data = { amount, token };
      const tokenAmount = new TokenAmount(data);

      const encodedData = tokenAmount.encode();

      expect(encodedData.amount).toMatchObject(amount);
      expect(encodedData.token).toMatchObject(token);
    });

    it('can be used to re-instantiate token amount again', () => {
      const data = generateTokenAmountData();
      const amount = new TokenAmount(data);

      const encodedData = amount.encode();
      const newTokenAmount = new TokenAmount(encodedData);
      const newEncodedData = newTokenAmount.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});

describe('EthereumAmount', () => {
  describe('parse()', () => {
    it('can parse integer based on 18 decimals', () => {
      const amount = EthereumAmount.parse('0.123456789123456789');

      expect(amount.decimalAmount).toBe('0.123456789123456789');
      expect(amount.uint256.asString).toBe('123456789123456789');
    });
  });
});
