/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import TransferHistory from '@/components/TransferHistory.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import * as groupingComposable from '@/composables/useTransferGrouping';
import { generateTransfer } from '~/utils/data_generators';

vi.mock('@/composables/useTransferGrouping');

function createWrapper(options?: { transfers?: Array<unknown> }) {
  return mount(TransferHistory, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            transfers: options?.transfers ?? [],
          },
        }),
      ],
      stubs: {
        LazyWrapper: {
          template: '<div><slot /></div>',
        },
      },
    },
  });
}

describe('TransferHistory.vue', () => {
  beforeEach(() => {
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([]),
    });
  });

  it('calls the grouping composable with store transfers and time windows', () => {
    createWrapper({ transfers: ['fake-transfer'] });

    expect(groupingComposable.useTransferGrouping).toHaveBeenCalledOnce();
    expect(groupingComposable.useTransferGrouping).toHaveBeenLastCalledWith(
      expect.anything(), // TODO: How to match typing from store?
      ref([
        { label: 'today', priority: 3, maxDaysAgo: 1 },
        { label: '3 days ago', priority: 2, maxDaysAgo: 3 },
        { label: 'last week', priority: 1, maxDaysAgo: 7 },
      ]),
    );
  });

  it('adds a transfer group for each time window', () => {
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([
        { label: 'window one', transfers: [generateTransfer()] },
        { label: 'window two', transfers: [generateTransfer()] },
      ]),
    });
    const wrapper = createWrapper();
    const transferGroups = wrapper.findAll('[data-test="transfer-group"]');

    expect(transferGroups).toHaveLength(2);
    expect(wrapper.text()).toContain('window one');
    expect(wrapper.text()).toContain('window two');
  });

  it('displays a transfer status for each transfer in all groups', () => {
    const transferOne = generateTransfer();
    const transferTwo = generateTransfer();
    const transferThree = generateTransfer();
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([
        { label: 'window one', transfers: [transferOne] },
        { label: 'window two', transfers: [transferTwo, transferThree] },
      ]),
    });
    const wrapper = createWrapper();
    const transferStatus = wrapper.findAllComponents(TransferStatus);

    expect(transferStatus).toHaveLength(3);
    expect(transferStatus[0].props()).toEqual(expect.objectContaining({ transfer: transferOne }));
    expect(transferStatus[1].props()).toEqual(expect.objectContaining({ transfer: transferTwo }));
    expect(transferStatus[2].props()).toEqual(
      expect.objectContaining({ transfer: transferThree }),
    );
  });

  it('sets first overall transfer to be expanded if being active', () => {
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([
        { label: 'window one', transfers: [generateTransfer({ active: true })] },
        { label: 'window two', transfers: [generateTransfer()] },
      ]),
    });
    const wrapper = createWrapper();
    const firstTransferStatus = wrapper.findComponent(TransferStatus);

    expect(firstTransferStatus.props()).toContain({ isExpanded: true });
  });
});
