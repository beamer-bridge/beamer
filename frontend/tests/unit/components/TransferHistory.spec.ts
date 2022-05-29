/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import TransferHistory from '@/components/TransferHistory.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import * as groupingComposable from '@/composables/useTransferGrouping';
import * as navigation from '@/router/navigation';
import { generateTransfer } from '~/utils/data_generators';

vi.mock('@/composables/useTransferGrouping');
vi.mock('@/router/navigation');

async function createWrapper(options?: { transfers?: Array<unknown> }) {
  const wrapper = mount(TransferHistory, {
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
        SafeTeleport: {
          template: '<div><slot /></div>',
        },
        ActionButton: {
          template: '<button><slot /></button>',
        },
      },
    },
  });

  // Wait for the next tick to see changes applied by `onMounted` hook.
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('TransferHistory.vue', () => {
  beforeEach(() => {
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([]),
    });
    navigation!.switchToActivities = vi.fn();
  });

  it('calls the grouping composable with store transfers and time windows', () => {
    createWrapper({ transfers: ['fake-transfer'] });

    expect(groupingComposable.useTransferGrouping).toHaveBeenCalledOnce();
    // TODO: Match call arguments when resolving typing issues.
  });

  it('adds a transfer group for each time window', async () => {
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([
        { label: 'window one', transfers: [generateTransfer()] },
        { label: 'window two', transfers: [generateTransfer()] },
      ]),
    });
    const wrapper = await createWrapper();
    const transferGroups = wrapper.findAll('[data-test="transfer-group"]');

    expect(transferGroups).toHaveLength(2);
    expect(wrapper.text()).toContain('window one');
    expect(wrapper.text()).toContain('window two');
  });

  it('displays a transfer status for each transfer in all groups', async () => {
    const transferOne = generateTransfer();
    const transferTwo = generateTransfer();
    const transferThree = generateTransfer();
    groupingComposable!.useTransferGrouping = vi.fn().mockReturnValue({
      groupedAndSortedTransfers: ref([
        { label: 'window one', transfers: [transferOne] },
        { label: 'window two', transfers: [transferTwo, transferThree] },
      ]),
    });
    const wrapper = await createWrapper();
    const transferStatus = wrapper.findAllComponents(TransferStatus);

    expect(transferStatus).toHaveLength(3);
    expect(transferStatus[0].props()).toEqual(expect.objectContaining({ transfer: transferOne }));
    expect(transferStatus[1].props()).toEqual(expect.objectContaining({ transfer: transferTwo }));
    expect(transferStatus[2].props()).toEqual(
      expect.objectContaining({ transfer: transferThree }),
    );
  });

  it('shows a button that switches back to requests', async () => {
    const wrapper = await createWrapper();
    const button = wrapper.find('[data-test="switch-to-request-button"]');

    expect(button.exists()).toBeTruthy();

    await button.trigger('click');

    expect(navigation.switchToRequestDialog).toHaveBeenCalledOnce();
  });
});
