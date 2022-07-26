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
    it('initialize settings store connectedWallet with undefined', () => {
      const settings = useSettings();
      expect(settings.$state.connectedWallet).toBeUndefined();
    });

    it('initialize settings store disclaimerChecked with false', () => {
      const settings = useSettings();
      expect(settings.$state.disclaimerChecked).toBe(false);
    });
  });

  describe('connected wallet', () => {
    it('can set a connected wallet', () => {
      const settings = useSettings();
      settings.connectedWallet = WalletType.MetaMask;
      expect(settings.$state.connectedWallet).toBe(WalletType.MetaMask);
    });
  });

  describe('disclaimer checked', () => {
    it('can set the disclaimer checked', () => {
      const settings = useSettings();
      settings.disclaimerChecked = true;
      expect(settings.$state.disclaimerChecked).toBe(true);
    });
  });
});
