import { ref } from 'vue';

import { useFaucet } from '@/composables/useFaucet';
import * as faucet from '@/services/transactions/faucet';
import { getRandomEthereumAddress } from '~/utils/data_generators';

vi.mock('@/services/transactions/faucet');
vi.mock('@ethersproject/providers');

const setupEnvironment = (env?: { [x: string]: string | number }): void => {
  Object.assign(import.meta.env, {
    VITE_FAUCET_ENABLED: 'true',
    ...env,
  });
};

describe('useFaucet', () => {
  beforeEach(() => {
    setupEnvironment();
  });

  it('can be disabled by setting VITE_FAUCET_ENABLED environment variable to false', async () => {
    setupEnvironment({ VITE_FAUCET_ENABLED: 'false' });
    const { enabled } = useFaucet(ref(undefined), ref(undefined));

    expect(enabled.value).toBe(false);
  });

  it('can be enabled by setting VITE_FAUCET_ENABLED environment variable to true', async () => {
    setupEnvironment({ VITE_FAUCET_ENABLED: 'true' });
    const ethereumAddress = ref(getRandomEthereumAddress());
    const chainId = ref(1);
    const { run, enabled } = useFaucet(ethereumAddress, chainId);

    await run();

    expect(enabled.value).toBe(true);
    expect(faucet.requestFaucet).toHaveBeenCalledOnce();
  });

  describe('enabled', () => {
    it('is true when faucet airdrop feature is enabled', () => {
      setupEnvironment({ VITE_FAUCET_ENABLED: 'true' });
      const { enabled } = useFaucet(ref(undefined), ref(undefined));

      expect(enabled.value).toBe(true);
    });
    it('is false when faucet airdrop feature is disabled', () => {
      setupEnvironment({ VITE_FAUCET_ENABLED: 'false' });
      const { enabled } = useFaucet(ref(undefined), ref(undefined));

      expect(enabled.value).toBe(false);
    });
  });

  describe('available', () => {
    it('is false when provided ethereum address is undefined', () => {
      const ethereumAddress = ref(undefined);
      const chainId = ref(1);
      const { available } = useFaucet(ethereumAddress, chainId);

      expect(available.value).toBeFalsy();
    });
    it('is false when provided chain id is undefined', () => {
      const ethereumAddress = ref(getRandomEthereumAddress());
      const chainId = ref(undefined);
      const { available } = useFaucet(ethereumAddress, chainId);

      expect(available.value).toBeFalsy();
    });
    it('is true when all the conditions are satisfied for running a faucet aidrop request', () => {
      const ethereumAddress = ref(getRandomEthereumAddress());
      const chainId = ref(1);
      const { available } = useFaucet(ethereumAddress, chainId);

      expect(available.value).toBeTruthy();
    });
  });

  describe('run()', () => {
    describe('when faucet is enabled', () => {
      it('executes a faucet token airdrop request', async () => {
        setupEnvironment({ VITE_FAUCET_ENABLED: 'true' });
        const ethereumAddress = ref(getRandomEthereumAddress());
        const chainId = ref(1);
        const { run } = useFaucet(ethereumAddress, chainId);

        await run();

        expect(faucet.requestFaucet).toHaveBeenNthCalledWith(
          1,
          chainId.value,
          ethereumAddress.value,
        );
      });

      it('can only be used once per session', async () => {
        setupEnvironment({ VITE_FAUCET_ENABLED: 'true' });
        const ethereumAddress = ref(getRandomEthereumAddress());
        const chainId = ref(1);
        const { run, error } = useFaucet(ethereumAddress, chainId);

        Object.defineProperty(faucet, 'requestFaucet', {
          value: vi.fn().mockResolvedValue(true),
        });

        await run();
        expect(error.value).toBeUndefined();
        expect(faucet.requestFaucet).toHaveBeenCalledOnce();

        await run();
        expect(error.value?.message).toBe('Maximum allowed faucet requests exceeded!');
        expect(faucet.requestFaucet).toHaveBeenCalledOnce();
      });
    });

    it('cannot be used when faucet is disabled', async () => {
      setupEnvironment({ VITE_FAUCET_ENABLED: 'false' });
      const { run, enabled, error } = useFaucet(ref(undefined), ref(undefined));

      expect(enabled.value).toBe(false);

      await run();
      expect(error.value?.message).toBe('Faucet is not enabled!');
      expect(faucet.requestFaucet).not.toHaveBeenCalled();
    });

    it('cannot be used when provided ethereum address is undefined', async () => {
      const ethereumAddress = ref(undefined);
      const chainId = ref(1);
      const { run, error } = useFaucet(ethereumAddress, chainId);

      await run();

      expect(error.value?.message).toBe('Address or chain id missing!');
      expect(faucet.requestFaucet).not.toHaveBeenCalled();
    });

    it('cannot be used when provided chain id is undefined', async () => {
      const ethereumAddress = ref(getRandomEthereumAddress());
      const chainId = ref(undefined);
      const { run, error } = useFaucet(ethereumAddress, chainId);

      await run();

      expect(error.value?.message).toBe('Address or chain id missing!');
      expect(faucet.requestFaucet).not.toHaveBeenCalled();
    });
  });
});
