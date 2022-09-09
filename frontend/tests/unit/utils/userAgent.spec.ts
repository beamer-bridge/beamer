import { isMobile } from '@/utils/userAgent';

describe('userAgent', () => {
  describe('isMobile()', () => {
    it('returns true if provided user agent matches a mobile device', () => {
      const userAgent =
        'Mozilla/5.0 (Linux; Android 7.0; SM-G930V Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36';

      expect(isMobile(userAgent)).toBe(true);
    });
    it("returns false if provided user agent doesn't match a mobile device", () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.33';

      expect(isMobile(userAgent)).toBe(false);
    });
  });
});
