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

    it('initialize settings store matomoConsentDeclined with false', () => {
      const settings = useSettings();
      expect(settings.$state.matomoConsentDeclined).toBe(false);
    });
  });

  describe('connected wallet', () => {
    it('can set a connected wallet', () => {
      const settings = useSettings();
      settings.connectedWallet = WalletType.MetaMask;
      expect(settings.$state.connectedWallet).toBe(WalletType.MetaMask);
    });
  });

  describe('matomo consent declined', () => {
    it('can decline the matomo consent', () => {
      const settings = useSettings();
      settings.matomoConsentDeclined = true;
      expect(settings.$state.matomoConsentDeclined).toBe(true);
    });
  });
});
