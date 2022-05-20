import type { Ref } from 'vue';
import { ref } from 'vue';

import type { Transfer } from '@/actions/transfers';
import { useTransferGrouping } from '@/composables/useTransferGrouping';
import { generateTransfer, generateTransferData } from '~/utils/data_generators';

describe('useTransferGrouping', () => {
  beforeEach(() => {
    vi.getMockedSystemTime();
  });

  afterEach(() => {
    vi.getRealSystemTime();
  });

  it('groups everything into "older" group per default', () => {
    const transfers = ref([generateTransfer(), generateTransfer()]) as unknown as Ref<
      Array<Transfer>
    >;
    const { groupedAndSortedTransfers } = useTransferGrouping(transfers, ref([]));

    expect(groupedAndSortedTransfers.value).toHaveLength(1);
    expect(groupedAndSortedTransfers.value[0].label).toBe('older');
    expect(groupedAndSortedTransfers.value[0].transfers).toHaveLength(2);
  });

  it('creates empty groups if there are no transfers', () => {
    const timeWindows = ref([
      { label: 'foo', priority: 2, maxDaysAgo: 1 },
      { label: 'bar', priority: 1, maxDaysAgo: 2 },
    ]);
    const { groupedAndSortedTransfers } = useTransferGrouping(ref([]), timeWindows);

    expect(groupedAndSortedTransfers.value).toHaveLength(3);
    expect(groupedAndSortedTransfers.value[0].transfers).toHaveLength(0);
    expect(groupedAndSortedTransfers.value[1].transfers).toHaveLength(0);
    expect(groupedAndSortedTransfers.value[2].transfers).toHaveLength(0);
  });

  it('sortes the groups by their priority with "older" as last', () => {
    const timeWindows = ref([
      { label: 'foo', priority: 1, maxDaysAgo: 1 },
      { label: 'bar', priority: 2, maxDaysAgo: 2 },
    ]);
    const { groupedAndSortedTransfers } = useTransferGrouping(ref([]), timeWindows);

    expect(groupedAndSortedTransfers.value[0].label).toBe('bar');
    expect(groupedAndSortedTransfers.value[1].label).toBe('foo');
    expect(groupedAndSortedTransfers.value[2].label).toBe('older');
  });

  it('puts the transfers into their correct groups in sorted order', () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const now = 10 * oneDay;
    const timeWindows = ref([
      { label: 'foo', priority: 2, maxDaysAgo: 1 },
      { label: 'bar', priority: 1, maxDaysAgo: 3 },
    ]);
    const transferOne = generateTransfer({ transferData: generateTransferData({ date: now }) });
    const transferTwo = generateTransfer({
      transferData: generateTransferData({ date: now - 0.9 * oneDay }),
    });
    const transferThree = generateTransfer({
      transferData: generateTransferData({ date: now - 1 * oneDay }),
    });
    const transferFour = generateTransfer({
      transferData: generateTransferData({ date: now - 2 * oneDay }),
    });
    const transferFive = generateTransfer({
      transferData: generateTransferData({ date: now - 3 * oneDay }),
    });
    const transferSix = generateTransfer({
      transferData: generateTransferData({ date: now - 9 * oneDay }),
    });
    const transfers = ref([
      transferTwo,
      transferOne,
      transferFive,
      transferThree,
      transferFour,
      transferSix,
    ]) as unknown as Ref<Array<Transfer>>;
    vi.setSystemTime(now);

    const { groupedAndSortedTransfers } = useTransferGrouping(transfers, timeWindows);

    expect(groupedAndSortedTransfers.value[0].transfers).toEqual([transferOne, transferTwo]);
    expect(groupedAndSortedTransfers.value[1].transfers).toEqual([transferThree, transferFour]);
    expect(groupedAndSortedTransfers.value[2].transfers).toEqual([transferFive, transferSix]);
  });
});
