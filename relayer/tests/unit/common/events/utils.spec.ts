import { fetchFirstMatchingEvent } from "@/common/events/utils";

describe("filter-utils", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("fetchFirstMatchingEvent()", () => {
    it("does nothing if block range is negative and returns undefined", async () => {
      const contract = { queryFilter: jest.fn() };

      const event = await fetchFirstMatchingEvent(contract, {}, 2, 1);

      expect(contract.queryFilter).not.toHaveBeenCalled();
      expect(event).toBeUndefined();
    });

    it("queries for events multiple times per chunk size", async () => {
      const contract = { queryFilter: jest.fn().mockResolvedValue([]) };

      fetchFirstMatchingEvent(contract, {}, 1, 9, {}, 2);

      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 6);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(3, expect.anything(), 7, 9);
      await jest.runOnlyPendingTimersAsync();
    });

    it("last event query reduces chunk size to match final block number", async () => {
      const contract = { queryFilter: jest.fn().mockResolvedValue([]) };

      fetchFirstMatchingEvent(contract, {}, 1, 5, {}, 2);

      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 5);
      await jest.runOnlyPendingTimersAsync();
    });

    it("returns event object if event was found", async () => {
      const contract = { queryFilter: jest.fn().mockResolvedValue(["fake-event"]) };

      const event = fetchFirstMatchingEvent(contract, {}, 1, 2);
      await jest.runOnlyPendingTimersAsync();

      expect(await event).not.toBeUndefined();
    });

    it("returns undefined if no event was found", async () => {
      const contract = { queryFilter: jest.fn().mockResolvedValue([]) };

      const found = fetchFirstMatchingEvent(contract, {}, 1, 2);

      expect(contract.queryFilter).toHaveBeenCalled();
      await jest.runOnlyPendingTimersAsync();

      expect(await found).toBeUndefined();
    });

    it("stops querying events once an event was found", async () => {
      const contract = {
        queryFilter: jest
          .fn()
          .mockReturnValueOnce([])
          .mockReturnValueOnce(["fake-event"])
          .mockResolvedValue([]),
      };

      fetchFirstMatchingEvent(contract, {}, 1, 9, {}, 2);

      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 3);
      await jest.runOnlyPendingTimersAsync();
      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 4, 6);
      await jest.runOnlyPendingTimersAsync();
      expect(contract.queryFilter).not.toHaveBeenCalledWith(expect.anything(), 7, 9);
      await jest.runOnlyPendingTimersAsync();
    });

    it("reduces the chunk size by half with every error and retries", async () => {
      const contract = {
        queryFilter: jest
          .fn()
          .mockRejectedValueOnce(null)
          .mockRejectedValueOnce(null)
          .mockResolvedValue([]),
      };

      fetchFirstMatchingEvent(contract, {}, 1, 6, {}, 4);

      expect(contract.queryFilter).toHaveBeenNthCalledWith(1, expect.anything(), 1, 5);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(2, expect.anything(), 1, 3);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(3, expect.anything(), 1, 2);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(4, expect.anything(), 3, 4);
      await jest.runOnlyPendingTimersAsync();

      expect(contract.queryFilter).toHaveBeenNthCalledWith(5, expect.anything(), 5, 6);
      await jest.runOnlyPendingTimersAsync();
    });

    it("filters events by arguments", async () => {
      const contract = {
        queryFilter: jest.fn().mockResolvedValue([{ args: { id: 1 } }, { args: { id: 2 } }]),
      };

      const event = fetchFirstMatchingEvent(contract, {}, 1, 2, { id: 2 });
      await jest.runOnlyPendingTimersAsync();

      expect(await event).toEqual({ args: { id: 2 } });
    });
  });
});
