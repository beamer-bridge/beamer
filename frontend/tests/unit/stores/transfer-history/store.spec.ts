import { createPinia, setActivePinia } from 'pinia';

import { Transfer } from '@/actions/transfers';
import {
  getAppMajorVersion,
  getStoreName,
  useTransferHistory,
} from '@/stores/transfer-history/store';
import {
  generateChain,
  generateStepData,
  generateTransfer,
  generateTransferData,
} from '~/utils/data_generators';

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

  describe('instance', () => {
    it('should include semantic version of the app inside its name', () => {
      const history = useTransferHistory();
      const semver = process.env.npm_package_version;

      expect(history.$id).toBe(`transferHistory_${semver?.split('.')[0]}`);
    });
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

  describe('hasPendingTransactionsForChain getter', () => {
    const CHAIN_ID = 100;

    it('returns true if there is at least one pending transfer (request creation transaction waiting to be mined)', () => {
      const history = useTransferHistory();
      const activeTransfer = generateTransfer({
        active: true,
        transferData: { sourceChain: generateChain({ identifier: CHAIN_ID }) },
      });

      history.addTransfer(activeTransfer);

      const hasPendingTransactions = history.hasPendingTransactionsForChain(CHAIN_ID);

      expect(hasPendingTransactions).toBe(true);
    });
    it('returns false if all the transfers are expired', () => {
      const history = useTransferHistory();
      const expiredTransfer = generateTransfer({
        transferData: { sourceChain: generateChain({ identifier: CHAIN_ID }), expired: true },
      });

      history.addTransfer(expiredTransfer);

      const hasPendingTransactions = history.hasPendingTransactionsForChain(CHAIN_ID);

      expect(hasPendingTransactions).toBe(false);
    });
    it('returns false if all the transfers are withdrawn', () => {
      const history = useTransferHistory();
      const withdrawnTransfer = generateTransfer({
        transferData: { sourceChain: generateChain({ identifier: CHAIN_ID }), withdrawn: true },
      });

      history.addTransfer(withdrawnTransfer);

      const hasPendingTransactions = history.hasPendingTransactionsForChain(CHAIN_ID);

      expect(hasPendingTransactions).toBe(false);
    });
    it('returns false if there are no transfers for the specified chain', () => {
      const history = useTransferHistory();
      const activeTransfer = generateTransfer({
        transferData: { sourceChain: generateChain({ identifier: CHAIN_ID }) },
        active: true,
      });

      history.addTransfer(activeTransfer);

      const hasPendingTransactions = history.hasPendingTransactionsForChain(101);

      expect(hasPendingTransactions).toBe(false);
    });

    it('considers the transfer as pending if one of the first 3 steps are active', () => {
      const history = useTransferHistory();
      const transferData = generateTransferData({
        sourceChain: generateChain({ identifier: CHAIN_ID }),
        steps: [
          ...new Array(3).fill(generateStepData({ active: false })),
          generateStepData({ active: true }),
        ],
      });

      const activeTransfer = new Transfer(transferData);
      history.addTransfer(activeTransfer);

      const hasPendingTransactions = history.hasPendingTransactionsForChain(CHAIN_ID);

      expect(hasPendingTransactions).toBe(false);
    });
  });
});
