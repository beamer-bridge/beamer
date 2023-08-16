import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import Transfer from '@/components/Transfer.vue';
import TransferHistory from '@/components/TransferHistory.vue';
import * as groupingComposable from '@/composables/useTransferGrouping';
import * as navigation from '@/router/navigation';
import * as useEthereumWalletComposable from '@/stores/ethereum-wallet';
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
    Object.defineProperty(useEthereumWalletComposable, 'useEthereumWallet', {
      value: vi.fn().mockReturnValue({
        signer: ref('fake-signer'),
      }),
    });
    Object.defineProperty(groupingComposable, 'useTransferGrouping', {
      value: vi.fn().mockReturnValue({
        groupedAndSortedTransfers: ref([]),
      }),
    });
    Object.defineProperty(navigation, 'switchToActivities', {
      value: vi.fn(),
    });
  });

  it('calls the grouping composable with store transfers and time windows', () => {
    createWrapper({ transfers: ['fake-transfer'] });

    expect(groupingComposable.useTransferGrouping).toHaveBeenCalledOnce();
    // TODO: Match call arguments when resolving typing issues.
  });

  it('adds a transfer group for each time window', async () => {
    Object.defineProperty(groupingComposable, 'useTransferGrouping', {
      value: vi.fn().mockReturnValue({
        groupedAndSortedTransfers: ref([
          { label: 'window one', transfers: [generateTransfer()] },
          { label: 'window two', transfers: [generateTransfer()] },
        ]),
      }),
    });
    const wrapper = await createWrapper();
    const transfers = wrapper.findAll('[data-test="transfer"]');

    expect(transfers).toHaveLength(2);
    expect(wrapper.text()).toContain('window one');
    expect(wrapper.text()).toContain('window two');
  });

  it('displays a transfer for each transfer in all groups', async () => {
    const transferOne = generateTransfer();
    const transferTwo = generateTransfer();
    const transferThree = generateTransfer();
    Object.defineProperty(groupingComposable, 'useTransferGrouping', {
      value: vi.fn().mockReturnValue({
        groupedAndSortedTransfers: ref([
          { label: 'window one', transfers: [transferOne] },
          { label: 'window two', transfers: [transferTwo, transferThree] },
        ]),
      }),
    });
    const wrapper = await createWrapper();
    const transfers = wrapper.findAllComponents(Transfer);

    expect(transfers).toHaveLength(3);
    expect(transfers[0].props()).toEqual(expect.objectContaining({ transfer: transferOne }));
    expect(transfers[1].props()).toEqual(expect.objectContaining({ transfer: transferTwo }));
    expect(transfers[2].props()).toEqual(expect.objectContaining({ transfer: transferThree }));
  });

  it('shows a button that switches back to requests', async () => {
    const wrapper = await createWrapper();
    const button = wrapper.find('[data-test="switch-to-request-button"]');

    expect(button.exists()).toBeTruthy();

    await button.trigger('click');

    expect(navigation.switchToRequestDialog).toHaveBeenCalledOnce();
  });
});
