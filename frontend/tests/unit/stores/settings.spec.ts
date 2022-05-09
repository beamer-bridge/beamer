import '~/utils/mocks/globals';

import { createPinia, setActivePinia } from 'pinia';

import { useSettings } from '@/stores/settings';
import { WalletType } from '@/types/settings';

describe('settings store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('setConnectedWallet', () => {
    it('can set a connected wallet', () => {
      const settings = useSettings();
      settings.setConnectedWallet(WalletType.Metamask);
      expect(settings.$state.settings?.connectedWallet).toBe(WalletType.Metamask);
    });
  });

  describe('connectedWallet getter', () => {
    it('can get connected wallet value', () => {
      const settings = useSettings();
      settings.setConnectedWallet(WalletType.Metamask);
      const connectedWallet = settings.connectedWallet;
      expect(connectedWallet).toBe(WalletType.Metamask);
    });
  });
});
