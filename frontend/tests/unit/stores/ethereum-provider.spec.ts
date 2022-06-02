import type { JsonRpcSigner } from '@ethersproject/providers';
import { createPinia, setActivePinia } from 'pinia';

import { useEthereumProvider } from '@/stores/ethereum-provider';
import { MockedMetaMaskProvider } from '~/utils/mocks/ethereum-provider';

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('signer getter', () => {
    it('is undefined is provider state is undefined', () => {
      const ethereumProvider = useEthereumProvider();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.signer).toBeUndefined();
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumProvider();
      // TODO: Creating a mocked signer is not trivial. It will help to remove
      // 3rd party types from our own types. Therefore use this ugly hack here.
      const signer = { fake: 'signer' } as unknown as JsonRpcSigner;
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({ signer });

      expect(ethereumProvider.signer).toBe(signer);
    });
  });

  describe('signerAddress getter', () => {
    it('is an empty string if provider state is undefined', () => {
      const ethereumProvider = useEthereumProvider();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.signerAddress).toBe('');
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumProvider();
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({
        signerAddress: '0xSignerAddress',
      });

      expect(ethereumProvider.signerAddress).toBe('0xSignerAddress');
    });
  });

  describe('chainId getter', () => {
    it('is -1 if provider state is undefined', () => {
      const ethereumProvider = useEthereumProvider();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.chainId).toBe(-1);
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumProvider();
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({ chainId: 5 });

      expect(ethereumProvider.chainId).toBe(5);
    });
  });
});
