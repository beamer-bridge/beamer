import { SubsidizedTransfer, Transfer } from '@/actions/transfers';
import { transferHistorySerializer } from '@/stores/transfer-history/serializer';
import { generateChain, generateStepData, generateTransferData } from '~/utils/data_generators';

vi.mock('@/actions/transfers', async (importOriginal) => {
  const mod: object = await importOriginal();
  return {
    ...mod,
    Transfer: vi.fn().mockImplementation((data) => ({ data })),
    SubsidizedTransfer: vi.fn().mockImplementation((data) => ({ data })),
  };
});

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

  describe('deserialize()', () => {
    it('returns empty list of transfers if retrieved data can not be parsed as an object', () => {
      global.console.error = vi.fn();

      const state = transferHistorySerializer.deserialize('1');

      expect(state.transfers).toEqual([]);
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

    it('is able to detect and create instances of subsidized and non-subsidized transfers accordingly', () => {
      const subsidizedTransferData = generateTransferData({
        sourceChain: generateChain({ feeSubAddress: '0x123' }),
        feeSubAddress: '0x123',
      });
      const unsubsidizedTransferData = generateTransferData();

      const state = transferHistorySerializer.deserialize(
        JSON.stringify({
          transfers: [subsidizedTransferData, unsubsidizedTransferData],
        }),
      );

      expect(state.transfers[0]).toBeInstanceOf(SubsidizedTransfer);
      expect(state.transfers[1]).toBeInstanceOf(Transfer);
    });

    it('returns filled state with transfers from parsed data', () => {
      const transferOneData = generateTransferData();
      const transferTwoData = generateTransferData();

      const state = transferHistorySerializer.deserialize(
        JSON.stringify({
          transfers: [transferOneData, transferTwoData],
        }),
      );

      expect(state.transfers[0]).toEqual(new Transfer(transferOneData));
      expect(state.transfers[1]).toEqual(new Transfer(transferTwoData));
    });

    it('sets all transfer to being inactive', () => {
      const stepOne = generateStepData({ active: false });
      const stepTwo = generateStepData({ active: true });
      const transferData = generateTransferData({ steps: [stepOne, stepTwo] });

      const state = transferHistorySerializer.deserialize(
        JSON.stringify({ transfers: [transferData] }),
      );

      expect(state.transfers[0]).toEqual(
        new Transfer({
          ...transferData,
          steps: [stepOne, { ...stepTwo, active: false }],
        }),
      );
    });

    it('sets the state to be loaded', () => {
      const state = transferHistorySerializer.deserialize(JSON.stringify({}));

      expect(state.loaded).toBeTruthy();
    });
  });
});
