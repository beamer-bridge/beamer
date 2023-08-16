import type { JsonRpcSigner } from '@ethersproject/providers';
import { createPinia, setActivePinia } from 'pinia';

import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { BLACKLIST_ADDRESSES } from '@/utils/addressBlacklist';
import { MockedMetaMaskProvider } from '~/utils/mocks/ethereum-provider';

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('signer getter', () => {
    it('is undefined is provider state is undefined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.signer).toBeUndefined();
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumWallet();
      // TODO: Creating a mocked signer is not trivial. It will help to remove
      // 3rd party types from our own types. Therefore use this ugly hack here.
      const signer = { fake: 'signer' } as unknown as JsonRpcSigner;
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({ signer });

      expect(ethereumProvider.signer).toBe(signer);
    });
  });

  describe('signerAddress getter', () => {
    it('is an empty string if provider state is undefined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.signerAddress).toBe('');
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({
        signerAddress: '0xSignerAddress',
      });

      expect(ethereumProvider.signerAddress).toBe('0xSignerAddress');
    });
  });

  describe('chainId getter', () => {
    it('is -1 if provider state is undefined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.chainId).toBe(-1);
    });

    it('mirrors the value of the providers property if state is defined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({ chainId: 5 });

      expect(ethereumProvider.chainId).toBe(5);
    });
  });
  describe('isBlacklistedWallet getter', () => {
    it('is false when signer is not defined', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = undefined;

      expect(ethereumProvider.isBlacklistedWallet).toBe(false);
    });
    it('is false when signer is defined but signer address is not blacklisted', () => {
      const ethereumProvider = useEthereumWallet();
      // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
      const signerAddress = '0x0b789C16c313164DD27B8b751D8e7320c838BC47';
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({
        signerAddress,
      });
      expect(ethereumProvider.isBlacklistedWallet).toBe(false);
    });
    it('is true when signer is defined and signer address is blacklisted', () => {
      const ethereumProvider = useEthereumWallet();
      ethereumProvider.$state.provider = new MockedMetaMaskProvider({
        signerAddress: BLACKLIST_ADDRESSES[0],
      });
      expect(ethereumProvider.isBlacklistedWallet).toBe(true);
    });
  });
});
