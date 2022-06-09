import { fetchUntilFirstMatchingEvent } from '@/services/transactions/fill-manager';

describe('fill-manager', () => {
  describe('fetchUntilFirstMatchingEvent()', () => {
    beforeEach(() => {
      global.console.error = vi.fn();
    });

    it('does nothing if block range is negative and returns false', async () => {
      const contract = { queryFilter: vi.fn() };

      const found = await fetchUntilFirstMatchingEvent(contract, {}, 2, 1);

      expect(contract.queryFilter).not.toHaveBeenCalled();
      expect(found).toBeFalsy();
    });

    it('queries for events multiple times per chunk size', async () => {
      const contract = { queryFilter: vi.fn().mockResolvedValue([]) };

      await fetchUntilFirstMatchingEvent(contract, {}, 1, 9, 2);

      expect(contract.queryFilter).toHaveBeenCalledTimes(3);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 6);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(3, expect.anything(), 7, 9);
    });

    it('last event query reduces chunk size to match final block number', async () => {
      const contract = { queryFilter: vi.fn().mockResolvedValue([]) };

      await fetchUntilFirstMatchingEvent(contract, {}, 1, 5, 2);

      expect(contract.queryFilter).toHaveBeenCalledTimes(2);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 5);
    });

    it('returns true if event got found', async () => {
      const contract = { queryFilter: vi.fn().mockResolvedValue(['fake-event']) };

      const found = await fetchUntilFirstMatchingEvent(contract, {}, 1, 2);

      expect(found).toBeTruthy();
    });

    it('returns false if no event was found', async () => {
      const contract = { queryFilter: vi.fn().mockResolvedValue([]) };

      const found = await fetchUntilFirstMatchingEvent(contract, {}, 1, 2);

      expect(contract.queryFilter).toHaveBeenCalled();
      expect(found).toBeFalsy();
    });

    it('stops quering events once an event was found', async () => {
      const contract = {
        queryFilter: vi
          .fn()
          .mockReturnValueOnce([])
          .mockReturnValueOnce(['fake-event'])
          .mockResolvedValue([]),
      };

      await fetchUntilFirstMatchingEvent(contract, {}, 1, 9, 2);

      expect(contract.queryFilter).toHaveBeenCalledTimes(2);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 6);
      expect(contract.queryFilter).not.toHaveBeenCalledWith(expect.anything(), 7, 9);
    });

    it('reduces the chunk size by half with every error and retries', async () => {
      const contract = {
        queryFilter: vi
          .fn()
          .mockRejectedValueOnce(null)
          .mockRejectedValueOnce(null)
          .mockResolvedValue([]),
      };

      await fetchUntilFirstMatchingEvent(contract, {}, 1, 6, 4);

      expect(contract.queryFilter).toHaveBeenCalledTimes(5);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 5);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 1, 3);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(3, expect.anything(), 1, 2);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(4, expect.anything(), 3, 4);
      expect(contract.queryFilter).toHaveBeenNthCalledWith(5, expect.anything(), 5, 6);
    });
  });
});
