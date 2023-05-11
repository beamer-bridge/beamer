import { shallowMount } from '@vue/test-utils';

import TransferComplete from '@/components/notifications/TransferComplete.vue';
import {
  generateRequestFulfillmentData,
  generateRequestInformationData,
  generateTransfer,
} from '~/utils/data_generators';

describe('TransferComplete.vue', () => {
  it('renders a message showing the time it took to finalize the transfer', () => {
    const transfer = generateTransfer({
      transferData: {
        requestInformation: generateRequestInformationData({ timestamp: 1 }),
        requestFulfillment: generateRequestFulfillmentData({ timestamp: 100 }),
      },
    });
    const wrapper = shallowMount(TransferComplete, {
      props: {
        transfer,
      },
    });
    const message = wrapper.find('[data-test="message"]');
    expect(message.text()).toBe(`Transfer completed in ${transfer.transferTimeSeconds}s.`);
  });

  it('shows a general completion message when transfer time is not defined', () => {
    const transfer = generateTransfer();
    const wrapper = shallowMount(TransferComplete, {
      props: {
        transfer,
      },
    });
    const message = wrapper.find('[data-test="message"]');
    expect(message.text()).toBe(`Transfer completed.`);
  });
});
