import { BLACKLIST_ADDRESSES, isAddressBlacklisted } from '@/utils/addressBlacklist';
import { getRandomEthereumAddress } from '~/utils/data_generators';

describe('addressBlacklist', () => {
  describe('BLACKLIST_ADDRESSES', () => {
    it('holds the list of blacklisted addresses', () => {
      expect(BLACKLIST_ADDRESSES).not.toHaveLength(0);
    });
  });

  describe('isAddressBlacklisted', () => {
    // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
    const blacklistedAddress = '0x61437b5BEa6F897b76E6B2F39e1332F1dA47712F';
    const blacklist = [blacklistedAddress, getRandomEthereumAddress()];
    it('returns true if provided address is in the provided blacklist', () => {
      expect(isAddressBlacklisted(blacklistedAddress, blacklist)).toBe(true);
    });
    it('returns false if provided address is not in the provided blacklist', () => {
      // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
      const normalAddress = '0x0b789C16c313164DD27B8b751D8e7320c838BC47';
      expect(isAddressBlacklisted(normalAddress, blacklist)).toBe(false);
    });

    describe('when no blacklist is provided', () => {
      it('checks against default blacklist', () => {
        // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
        const normalAddress = '0x0b789C16c313164DD27B8b751D8e7320c838BC47';
        const blacklistedAddress = BLACKLIST_ADDRESSES[0];

        expect(isAddressBlacklisted(normalAddress)).toBe(false);
        expect(isAddressBlacklisted(blacklistedAddress)).toBe(true);
      });
    });
  });
});
