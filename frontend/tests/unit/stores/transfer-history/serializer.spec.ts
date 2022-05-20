import { Transfer } from '@/actions/transfers';
import { transferHistorySerializer } from '@/stores/transfer-history/serializer';
import { generateTransferData } from '~/utils/data_generators';

vi.mock('@/actions/transfers', () => ({
  Transfer: vi.fn().mockImplementation((data) => ({ data })),
}));

describe('transfer history serializer', () => {
  describe('serialize()', () => {
    it('calls the encode function of each transfer', () => {
      const transferOne = { encode: vi.fn() };
      const transferTwo = { encode: vi.fn() };
      const state = { transfers: [transferOne, transferTwo] };

      transferHistorySerializer.serialize(state);

      expect(transferOne.encode).toHaveBeenCalledOnce();
      expect(transferTwo.encode).toHaveBeenCalledOnce();
    });

    it('stringifies the encoded transfers', () => {
      const transferOne = { encode: vi.fn().mockReturnValue('transfer one data') };
      const transferTwo = { encode: vi.fn().mockReturnValue('transfer two data') };
      const state = { transfers: [transferOne, transferTwo] };

      const serializedState = transferHistorySerializer.serialize(state);

      expect(serializedState).toBe('{"transfers":["transfer one data","transfer two data"]}');
    });
  });

  describe('getItem()', () => {
    it('returns empty state if retrieved data can not be parsed as an object', () => {
      global.console.error = vi.fn();

      const state = transferHistorySerializer.deserialize('1');

      expect(state).toEqual({ transfers: [] });
    });

    it('reports error to console if retrieved data can not be parsed', () => {
      global.console.error = vi.fn();

      transferHistorySerializer.deserialize('1');

      expect(global.console.error).toHaveBeenCalledOnce();
      expect(global.console.error).toHaveBeenLastCalledWith(
        'Failed to load unknown format for transfer history store!',
      );
    });

    it('calls the transfer constructor to parse all stored transfer data', () => {
      transferHistorySerializer.deserialize(
        '{"transfers": ["transfer one data", "transfer two data"]}',
      );

      expect(Transfer).toHaveBeenCalledTimes(2);
      expect(Transfer).toHaveBeenCalledWith('transfer one data');
      expect(Transfer).toHaveBeenCalledWith('transfer two data');
    });

    it('returns filled state with transfers from parsed data', () => {
      const transferOneData = generateTransferData();
      const transferTwoData = generateTransferData();

      const state = transferHistorySerializer.deserialize(
        JSON.stringify({
          transfers: [transferOneData, transferTwoData],
        }),
      );

      expect(state).toEqual({
        transfers: [new Transfer(transferOneData), new Transfer(transferTwoData)],
      });
    });
  });
});
