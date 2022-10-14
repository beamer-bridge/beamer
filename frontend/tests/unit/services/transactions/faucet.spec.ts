import { requestFaucet } from '@/services/transactions/faucet';
import { getRandomEthereumAddress, getRandomNumber } from '~/utils/data_generators';

describe('faucet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });
  describe('requestFaucet()', () => {
    it('initiates a request for test token airdrop', async () => {
      const chainId = getRandomNumber();
      const receiverAddress = getRandomEthereumAddress();

      await requestFaucet(chainId, receiverAddress);

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `https://faucet.beamerbridge.com/${chainId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ address: receiverAddress }),
        }),
      );
    });

    it('returns the status of the request', async () => {
      const chainId = getRandomNumber();
      const receiverAddress = getRandomEthereumAddress();

      await expect(requestFaucet(chainId, receiverAddress)).resolves.toBeTypeOf('boolean');
    });
  });
});
