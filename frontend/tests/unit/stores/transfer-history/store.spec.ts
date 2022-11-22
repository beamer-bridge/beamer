import { createPinia, setActivePinia } from 'pinia';

import {
  getAppMajorVersion,
  getStoreName,
  useTransferHistory,
} from '@/stores/transfer-history/store';
import { generateTransfer } from '~/utils/data_generators';

describe('store utility functions', () => {
  describe('getAppMajorVersion()', () => {
    it('returns the major version from the provided semver string', () => {
      const semver = '1.5.3';
      expect(getAppMajorVersion(semver)).toBe('1');
    });
  });
  describe('getStoreName()', () => {
    it('returns the base store name when app major version is 0', () => {
      const storeName = getStoreName(getAppMajorVersion('0.1.0'));
      expect(storeName).toBe('transferHistory');
    });
    it('returns the store name based on the app major version', () => {
      const storeName = getStoreName(getAppMajorVersion('2.1.0'));
      expect(storeName).toBe('transferHistory_2');
    });
  });
});

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('addTransfer()', () => {
    it('adds new transfer to the beginning of the list', () => {
      const history = useTransferHistory();
      const oldTransfer = generateTransfer();
      const newTransfer = generateTransfer();
      history.$state = { transfers: [oldTransfer], loaded: false };

      history.addTransfer(newTransfer);

      expect(history.transfers).toHaveLength(2);
      expect(history.transfers[0]).toEqual(newTransfer);
    });
  });
});
