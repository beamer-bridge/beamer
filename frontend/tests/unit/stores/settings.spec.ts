import '~/utils/mocks/globals';

import { createPinia, setActivePinia } from 'pinia';

import { useSettings } from '@/stores/settings';
import { WalletType } from '@/types/settings';

describe('settings store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });
  describe('Settings initial value', () => {
    it('initialize settings store with undefined values', () => {
      const settings = useSettings();
      expect(settings.$state.connectedWallet).toBeUndefined();
    });
  });

  describe('set connected wallet', () => {
    it('can set a connected wallet', () => {
      const settings = useSettings();
      settings.connectedWallet = WalletType.MetaMask;
      expect(settings.$state.connectedWallet).toBe(WalletType.MetaMask);
    });
  });
});
