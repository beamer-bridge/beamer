import { TokenAmount } from '@/types/token-amount';
import { BLACKLIST_ADDRESSES } from '@/utils/addressBlacklist';
import {
  isUnsignedNumeric,
  isValidEthAddress,
  makeIsNotBlacklistedEthAddressValidator,
  makeMatchingDecimalsValidator,
  makeMaxTokenAmountValidator,
  makeMinTokenAmountValidator,
  makeNotSameAsChainValidator,
} from '@/validation/validators';
import { generateChain, generateToken, getRandomEthereumAddress } from '~/utils/data_generators';

describe('validators', () => {
  describe('isValidEthAddress()', () => {
    it('returns true if provided value is a valid ETH address', () => {
      // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
      const address = '0x61437b5BEa6F897b76E6B2F39e1332F1dA47712F';
      expect(isValidEthAddress(address)).toBe(true);
    });
    it('returns false if provided value is not a valid ETH address', () => {
      const address = '0x123';
      expect(isValidEthAddress(address)).toBe(false);
    });
    it('returns false if provided value is not a valid checksum ETH address', () => {
      const address = '0x61437b5BEa6F897b76E6B2F39e1332F1dA47712f';
      expect(isValidEthAddress(address)).toBe(false);
    });
  });

  describe('isUnsignedNumeric()', () => {
    it('returns true if provided value is an unsigned numeric value', () => {
      const value = '123.123';
      expect(isUnsignedNumeric(value)).toBe(true);
    });
    it('returns false if provided value is not a numeric value', () => {
      const value = 'asdf';
      expect(isUnsignedNumeric(value)).toBe(false);
    });
    it('returns false if provided value contains multiple decimal separators', () => {
      const value = '1.1.1';
      expect(isUnsignedNumeric(value)).toBe(false);
    });
  });

  describe('makeMatchingDecimalsValidator()', () => {
    const decimalsAllowed = 10;
    const validator = makeMatchingDecimalsValidator(decimalsAllowed);
    it('returns true when provided value contains less decimals than allowed', () => {
      let value = 1.000_1;
      expect(validator(value.toString())).toBe(true);

      value = 1;
      expect(validator(value.toString())).toBe(true);
    });
    it('returns true when provided value contains same amount of decimals as allowed', () => {
      const value = 1.000_000_000_1;
      expect(validator(value.toString())).toBe(true);
    });
    it('returns false when provided value contains more decimals than allowed', () => {
      const value = 1.000_000_000_001;
      expect(validator(value.toString())).toBe(false);
    });
  });

  describe('makeNotSameAsChainValidator()', () => {
    const chainOne = generateChain();
    const validator = makeNotSameAsChainValidator(chainOne);

    it('returns true when chains are different', () => {
      const chainTwo = generateChain();
      expect(validator(chainTwo)).toBe(true);
    });

    it('returns false when both chains are same', () => {
      const chainTwo = chainOne;
      expect(validator(chainTwo)).toBe(false);
    });
  });

  describe('makeMinTokenAmountValidator()', () => {
    const token = generateToken({ decimals: 18 });
    const min = TokenAmount.parse(String(1.000_1), token);
    const validator = makeMinTokenAmountValidator(min);

    it('returns false when provided value is less than min number', () => {
      const value = TokenAmount.parse(String(1.000_01), token);
      expect(validator(value)).toBe(false);
    });
    it('returns true when provided value is equal to min number', () => {
      const value = min;
      expect(validator(value)).toBe(true);
    });
    it('returns true when provided value is higher than min number', () => {
      let value = TokenAmount.parse(String(1.000_3), token);
      expect(validator(value)).toBe(true);

      value = TokenAmount.parse(String(1.000_100_001), token);
      expect(validator(value)).toBe(true);
    });
  });

  describe('makeMaxTokenAmountValidator()', () => {
    const token = generateToken({ decimals: 18 });
    const max = TokenAmount.parse(String(1.000_1), token);
    const validator = makeMaxTokenAmountValidator(max);

    it('returns false when provided value is greater than max number', () => {
      let value = TokenAmount.parse(String(1.000_3), token);
      expect(validator(value)).toBe(false);

      value = TokenAmount.parse(String(1.000_100_001), token);
      expect(validator(value)).toBe(false);
    });

    it('returns true when provided value is equal to max number', () => {
      const value = max;
      expect(validator(value)).toBe(true);
    });

    it('returns true when provided value is less than max number', () => {
      const value = TokenAmount.parse(String(1.000_01), token);
      expect(validator(value)).toBe(true);
    });
  });

  describe('makeIsNotBlacklistedEthAddressValidator()', () => {
    // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
    const blacklistedAddress = '0x61437b5BEa6F897b76E6B2F39e1332F1dA47712F';
    const blacklistAddresses = [blacklistedAddress, getRandomEthereumAddress()];
    const validator = makeIsNotBlacklistedEthAddressValidator(blacklistAddresses);

    it('returns false when provided address value is found inside the blacklist', () => {
      expect(validator(blacklistedAddress)).toBe(false);
    });

    it('returns true when provided address value is not found inside the blacklist', () => {
      // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
      const normalAddress = '0x0b789C16c313164DD27B8b751D8e7320c838BC47';
      expect(validator(normalAddress)).toBe(true);
    });
    describe('when no blacklist is provided', () => {
      const validator = makeIsNotBlacklistedEthAddressValidator();

      it('checks against default blacklist', () => {
        // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
        const normalAddress = '0x0b789C16c313164DD27B8b751D8e7320c838BC47';
        const blacklistedAddress = BLACKLIST_ADDRESSES[0];

        expect(validator(normalAddress)).toBe(true);
        expect(validator(blacklistedAddress)).toBe(false);
      });
    });
  });
});
