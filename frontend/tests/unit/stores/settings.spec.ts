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
    it('initialize settings store with undefined', () => {
      const settings = useSettings();
      expect(settings.$state.settings).toBeUndefined();
    });
  });

  describe('setConnectedWallet', () => {
    it('can set a connected wallet', () => {
      const settings = useSettings();
      settings.setConnectedWallet(WalletType.MetaMask);
      expect(settings.$state.settings?.connectedWallet).toBe(WalletType.MetaMask);
    });
  });

  describe('connectedWallet getter', () => {
    it('can get connected wallet value', () => {
      const settings = useSettings();
      settings.$state.settings = { connectedWallet: WalletType.MetaMask };
      const connectedWallet = settings.connectedWallet;
      expect(connectedWallet).toBe(WalletType.MetaMask);
    });
  });
});
